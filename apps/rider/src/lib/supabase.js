import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Values come from .env (see .env.example). EXPO_PUBLIC_* vars are inlined at
// build time, so changing them needs a Metro restart with --clear.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.\n' +
      'Copy apps/rider/.env.example to .env, fill it in, then restart with:\n' +
      '  npm start -w kaon-rider -- --clear'
  );
}

// The anon key is meant to ship inside the app — row level security is what
// actually protects the data. The service_role key must never appear here.
export const supabase = createClient(url, anonKey, {
  auth: {
    // supabase-js reaches for localStorage by default, which doesn't exist in
    // React Native. Without this the session vanishes on every app restart.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Native apps have no URL carrying a session to parse.
    detectSessionInUrl: false,
  },
});
