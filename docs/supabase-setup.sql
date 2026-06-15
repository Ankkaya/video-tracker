-- VideoTracker encrypted sync schema

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 保存被同步加密密码保护后的 Data Key
CREATE TABLE IF NOT EXISTS public.user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  kdf TEXT NOT NULL DEFAULT 'PBKDF2',
  kdf_hash TEXT NOT NULL DEFAULT 'SHA-256',
  kdf_iterations INTEGER NOT NULL DEFAULT 210000,
  salt TEXT NOT NULL,

  encrypted_data_key JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encryption key"
  ON public.user_encryption_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own encryption key"
  ON public.user_encryption_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own encryption key"
  ON public.user_encryption_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own encryption key"
  ON public.user_encryption_keys
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_user_encryption_keys_updated_at ON public.user_encryption_keys;

CREATE TRIGGER set_user_encryption_keys_updated_at
  BEFORE UPDATE ON public.user_encryption_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 保存加密后的同步业务数据
CREATE TABLE IF NOT EXISTS public.encrypted_sync_blobs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  schema_version INTEGER NOT NULL DEFAULT 1,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  encrypted_blob JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.encrypted_sync_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_encrypted_sync_blobs_updated_at ON public.encrypted_sync_blobs;

CREATE TRIGGER set_encrypted_sync_blobs_updated_at
  BEFORE UPDATE ON public.encrypted_sync_blobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
