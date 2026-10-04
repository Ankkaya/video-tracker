-- Run once in the existing Supabase project's SQL editor before using cloud reset.
-- No rows are deleted by this migration. Reset is performed only by an authenticated RPC.
BEGIN;

-- Existing tables keep their old defaults unless explicitly altered.
-- Never relabel existing ciphertext: old rows must be replaced by a v2 reset.
ALTER TABLE public.encrypted_sync_blobs ALTER COLUMN schema_version SET DEFAULT 2;
ALTER TABLE public.encrypted_sync_blobs ALTER COLUMN encryption_version SET DEFAULT 1;

CREATE OR REPLACE FUNCTION public.guard_encrypted_sync_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE key_row public.user_encryption_keys;
BEGIN
  IF NEW.schema_version IS DISTINCT FROM 2 OR NEW.encryption_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Only sync schema v2 with encryption v1 is supported';
  END IF;
  SELECT * INTO key_row FROM public.user_encryption_keys WHERE user_id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encryption key missing'; END IF;
  IF (key_row.encrypted_data_key ? 'reset_version' OR NEW.encrypted_blob ? 'key_salt')
    AND (NEW.encrypted_blob->>'key_salt') IS DISTINCT FROM key_row.salt THEN
    RAISE EXCEPTION 'Cloud encryption changed. Unlock sync with the new password.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_encrypted_sync_write ON public.encrypted_sync_blobs;
CREATE TRIGGER guard_encrypted_sync_write BEFORE INSERT OR UPDATE ON public.encrypted_sync_blobs
FOR EACH ROW EXECUTE FUNCTION public.guard_encrypted_sync_write();

CREATE OR REPLACE FUNCTION public.guard_encryption_key_reset()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.encrypted_data_key ? 'reset_version'
    AND (NEW.salt IS DISTINCT FROM OLD.salt OR NEW.encrypted_data_key IS DISTINCT FROM OLD.encrypted_data_key)
    AND current_setting('videotracker.reset_sync', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use reset_encrypted_sync to replace cloud encryption.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_encryption_key_reset ON public.user_encryption_keys;
CREATE TRIGGER guard_encryption_key_reset BEFORE UPDATE ON public.user_encryption_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_encryption_key_reset();

CREATE OR REPLACE FUNCTION public.reset_encrypted_sync(
  p_expected_salt text, p_salt text, p_encrypted_data_key jsonb,
  p_encrypted_blob jsonb, p_kdf_iterations integer
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_salt text; owner_id uuid := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  -- Serializes resets even before a user's first key exists.
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  SELECT salt INTO current_salt FROM public.user_encryption_keys WHERE user_id = owner_id FOR UPDATE;
  IF current_salt IS DISTINCT FROM p_expected_salt THEN
    RAISE EXCEPTION 'Cloud encryption changed. Try again.';
  END IF;
  IF p_encrypted_data_key IS NULL OR p_encrypted_blob IS NULL
    OR p_salt IS NULL OR p_salt = '' OR p_salt IS NOT DISTINCT FROM current_salt
    OR p_kdf_iterations IS DISTINCT FROM 210000
    OR (p_encrypted_data_key->>'algorithm') IS DISTINCT FROM 'AES-GCM'
    OR (p_encrypted_blob->>'algorithm') IS DISTINCT FROM 'AES-GCM'
    OR (p_encrypted_data_key->>'version') IS DISTINCT FROM '1'
    OR (p_encrypted_blob->>'version') IS DISTINCT FROM '1'
    OR (p_encrypted_data_key->>'reset_version') IS DISTINCT FROM '1'
    OR (p_encrypted_blob->>'key_salt') IS DISTINCT FROM p_salt
    OR NOT (p_encrypted_data_key ?& ARRAY['iv','data','version'])
    OR NOT (p_encrypted_blob ?& ARRAY['iv','data','version']) THEN
    RAISE EXCEPTION 'Invalid reset payload';
  END IF;
  PERFORM set_config('videotracker.reset_sync', 'on', true);
  INSERT INTO public.user_encryption_keys(user_id,kdf,kdf_hash,kdf_iterations,salt,encrypted_data_key)
    VALUES(owner_id,'PBKDF2','SHA-256',p_kdf_iterations,p_salt,p_encrypted_data_key)
    ON CONFLICT(user_id) DO UPDATE SET kdf=EXCLUDED.kdf,kdf_hash=EXCLUDED.kdf_hash,
      kdf_iterations=EXCLUDED.kdf_iterations,salt=EXCLUDED.salt,encrypted_data_key=EXCLUDED.encrypted_data_key;
  INSERT INTO public.encrypted_sync_blobs(user_id,schema_version,encryption_version,encrypted_blob)
    VALUES(owner_id,2,1,p_encrypted_blob)
    ON CONFLICT(user_id) DO UPDATE SET schema_version=2,encryption_version=1,encrypted_blob=EXCLUDED.encrypted_blob;
  PERFORM set_config('videotracker.reset_sync', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.reset_encrypted_sync(text,text,jsonb,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_encrypted_sync(text,text,jsonb,jsonb,integer) TO authenticated;
COMMIT;
