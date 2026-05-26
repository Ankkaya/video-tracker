import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Record {
  id: string;
  user_id: string;
  platform: string;
  video_id: string;
  title: string;
  thumbnail?: string;
  progress: number;
  duration: number;
  watched_at: string;
  updated_at: string;
}

export interface LocalRecord {
  id: string;
  platform: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  progress: number;
  duration: number;
  watchedAt: number;
}
