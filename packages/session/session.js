import { useEffect, useState } from 'react';

/**
 * Builds a useSession hook bound to one app's Supabase client.
 *
 * Takes the client as an argument because each app has its own — different
 * env vars, and the web dashboard doesn't need AsyncStorage. The hook itself
 * is identical everywhere, so it lives here rather than being copied.
 *
 *   export const useSession = createUseSession(supabase);
 */
export function createUseSession(supabase) {
  return function useSession() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let active = true;

      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      });

      // Fires on sign in, sign out and token refresh — this is what swaps the
      // auth screen away for the app, rather than any navigation call.
      const { data } = supabase.auth.onAuthStateChange((_event, next) => {
        if (active) setSession(next);
      });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }, []);

    return { session, loading };
  };
}
