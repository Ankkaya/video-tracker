-- 创建 records 表
CREATE TABLE IF NOT EXISTS public.records (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  progress NUMERIC NOT NULL DEFAULT 0,
  duration NUMERIC NOT NULL DEFAULT 0,
  watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  url TEXT NOT NULL DEFAULT '',
  CONSTRAINT records_pkey PRIMARY KEY (id),
  CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_records_platform ON public.records USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_records_video_id ON public.records USING btree (video_id);
CREATE INDEX IF NOT EXISTS idx_records_watched_at ON public.records USING btree (watched_at DESC);

-- 启用行级安全策略 (RLS)
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的记录
CREATE POLICY "Users can view own records"
  ON public.records
  FOR SELECT
  USING (auth.uid() = user_id);

-- 创建策略：用户只能插入自己的记录
CREATE POLICY "Users can insert own records"
  ON public.records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能更新自己的记录
CREATE POLICY "Users can update own records"
  ON public.records
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的记录
CREATE POLICY "Users can delete own records"
  ON public.records
  FOR DELETE
  USING (auth.uid() = user_id);

-- 创建触发器：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 创建 custom_sites 表
CREATE TABLE IF NOT EXISTS public.custom_sites (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_sites_pkey PRIMARY KEY (id),
  CONSTRAINT custom_sites_domain_key UNIQUE (domain),
  CONSTRAINT custom_sites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_custom_sites_user_id ON public.custom_sites USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_custom_sites_domain ON public.custom_sites USING btree (domain);

-- 启用行级安全策略 (RLS)
ALTER TABLE public.custom_sites ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的自定义站点
CREATE POLICY "Users can view own custom sites"
  ON public.custom_sites
  FOR SELECT
  USING (auth.uid() = user_id);

-- 创建策略：用户只能插入自己的自定义站点
CREATE POLICY "Users can insert own custom sites"
  ON public.custom_sites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能更新自己的自定义站点
CREATE POLICY "Users can update own custom sites"
  ON public.custom_sites
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的自定义站点
CREATE POLICY "Users can delete own custom sites"
  ON public.custom_sites
  FOR DELETE
  USING (auth.uid() = user_id);

-- 创建触发器：自动更新 updated_at 字段
CREATE TRIGGER set_custom_sites_updated_at
  BEFORE UPDATE ON public.custom_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
