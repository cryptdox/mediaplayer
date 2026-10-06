import { createClient } from '@supabase/supabase-js';

// Read-only access to the batools Supabase project (mp_ tables). Uploading and
// editing happen in the batools Music panel, not here.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example).');

export const supabase = createClient(url, key, { auth: { persistSession: false } });
