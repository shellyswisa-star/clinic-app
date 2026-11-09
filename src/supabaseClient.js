import { createClient } from '@supabase/supabase-js';

// חילוץ המשתנים
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// אם המשתנה מ-Vercel ריק או לא מתחיל ב-http, נשתמש בכתובת המקורית
const supabaseUrl = (envUrl && envUrl.trim().startsWith('http'))
  ? envUrl.trim()
  : 'https://qmmtacroqvsjiyttdfct.supabase.co';

const supabaseAnonKey = (envKey && envKey.trim().length > 0)
  ? envKey.trim()
  : 'sb_publishable_BPTVeJH-NHFIRj1YE-515w_E4TBg3L8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);