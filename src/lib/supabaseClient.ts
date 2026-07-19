import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your project values.',
  )
}

// Not parameterized with the generated Database type: without a live Supabase
// project to run `supabase gen types typescript` against, a hand-maintained
// generic drifts from the real schema silently. Each lib/*.ts function casts
// its response to the types in src/types/database.ts instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
