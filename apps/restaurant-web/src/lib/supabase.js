import { createClient } from '@supabase/supabase-js';

// Values come from .env (see .env.example). Vite only exposes VITE_* vars.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy apps/restaurant-web/.env.example to .env and restart the dev server.'
  );
}

// The anon key is meant to ship to the browser — row level security is what
// actually protects the data. The service_role key must never appear here.
// Browser localStorage is the right session store, so no override needed.
export const supabase = createClient(url, anonKey);
