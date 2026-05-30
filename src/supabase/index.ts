import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface Record {
  id: string;
  user_id: string;
  platform: string;
  video_id: string;
  url: string;
  title: string;
  thumbnail?: string;
  progress: number;
  duration: number;
  watched_at: string;
  updated_at: string;
}

export interface CustomSite {
  id: string;
  user_id: string;
  domain: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
