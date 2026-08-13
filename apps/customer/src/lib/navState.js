import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers which screen you were on.
//
// The basket already survives being closed; where you were did not. Anyone
// tracking a live order who switches apps — to answer a message, to check
// Maps — came back to the restaurant list and had to find their order again
// through the Orders tab.
//
// It also makes the app testable on one phone. Expo Go can only run one
// project at a time, so opening the rider app unloads the customer app
// entirely; without this, every switch between the two sides means navigating
// back to where you were by hand.

const STORAGE_KEY = 'food-dash.nav.v1';

// Restoring is only right when it feels like resuming. Coming back an hour
// later to the screen you left is helpful; opening the app on Thursday to a
// checkout screen from Monday is confusing, and worse if the basket it
// referred to has since been ordered. After the window it starts at Home.
const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;   // 2 hours

export function useNavigationState() {
  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState(undefined);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const saved = JSON.parse(raw);
          if (Date.now() - saved.savedAt < RESUME_WINDOW_MS) {
            setInitialState(saved.state);
          }
        }
      } catch {
        // A corrupt or unreadable position is not worth blocking the app for.
        // Worst case it opens at Home, which is where it opened before.
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, []);

  const onStateChange = useCallback((state) => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), state }),
    ).catch(() => {});
  }, []);

  return { ready, initialState, onStateChange };
}

/** Called on sign-out — the next person to use this phone starts at Home. */
export function clearNavigationState() {
  return AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
