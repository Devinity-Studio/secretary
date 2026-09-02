import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client
 * ใส่ค่าจริงในไฟล์ .env หรือ app config ก่อนใช้งาน
 * EXPO_PUBLIC_SUPABASE_URL=
 * EXPO_PUBLIC_SUPABASE_ANON_KEY=
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
