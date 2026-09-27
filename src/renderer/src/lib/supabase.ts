import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zvljvobozipyklurwbtv.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_oHJavQLAb62NSAN-ayKV-A_s_v7OGy0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
