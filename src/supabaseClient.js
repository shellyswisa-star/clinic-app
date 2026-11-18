import { createClient } from '@supabase/supabase-js'

// קריאת משתני הסביבה ב-Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// בדיקה למקרה שהמשתנים לא הוגדרו (עוזר מאוד באבחון תקלות)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase URL or Anon Key is missing! Check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)