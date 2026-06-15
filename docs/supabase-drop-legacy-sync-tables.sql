-- Drop legacy plaintext sync tables.
-- Run only after encrypted_sync_blobs contains the data you want to keep.

DROP TABLE IF EXISTS public.records;
DROP TABLE IF EXISTS public.custom_sites;
