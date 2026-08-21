import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

// Live location, reported while a rider is carrying an order.
//
// This runs as a background task rather than a screen effect on purpose: a
// rider following Google Maps has this app off-screen for most of the trip,
// and a foreground-only watcher would freeze the customer's map at the
// restaurant — which reads as broken rather than absent.

const TASK = 'food-dash-rider-location';

// Distance, not time. A rider stopped at a light or waiting for the kitchen
// sends nothing, which is both kinder to the battery and less noise in the
// customer's map. 50m is roughly a block.
const DISTANCE_METRES = 50;
// A floor so a stationary GPS drifting between fixes can't spam updates, and
// a ceiling so a slow crawl through traffic still shows movement.
const MIN_INTERVAL_MS = 10_000;

/**
 * Defined at module scope, not inside a component.
 *
 * The OS relaunches the whole JS context to deliver a background fix, and the
 * task has to already exist when it does. Registering it inside a screen would
 * mean it only exists while that screen has mounted at least once — which is
 * exactly the case background delivery does not have.
 */
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;

  // Only the newest fix matters. The OS may batch several while the app was
  // asleep, and reporting a trail of stale positions would make the customer's
  // marker jump backwards.
  const { latitude, longitude } = data.locations[data.locations.length - 1].coords;

  try {
    await supabase.rpc('report_rider_location', {
      p_lat: latitude,
      p_lng: longitude,
    });
  } catch {
    // Offline, or the session expired while backgrounded. The next fix will
    // carry the current position anyway, so there is nothing worth retrying
    // and nobody to show an error to.
  }
});

/**
 * Asks for permission to report location in the background.
 *
 * Two prompts on both platforms: "while using the app" first, then "always".
 * Android requires that order — asking for background before foreground is
 * refused outright — and iOS shows the second prompt more favourably once the
 * first has been granted.
 *
 * Returns what was actually granted so the caller can explain the consequence
 * rather than silently doing nothing.
 */
export async function requestLocationPermission() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return { foreground: false, background: false };

  const background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: background.granted };
}

export async function isTracking() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK);
  } catch {
    return false;
  }
}

/** Starts reporting. Safe to call again — starting twice is a no-op. */
export async function startTracking() {
  if (await isTracking()) return true;

  const { granted } = await Location.getBackgroundPermissionsAsync();
  if (!granted) return false;

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,   // ~100m; enough for a moving dot, cheaper than High
    distanceInterval: DISTANCE_METRES,
    timeInterval: MIN_INTERVAL_MS,
    pausesUpdatesAutomatically: false,      // iOS would stop when it decides you've parked
    // Android shows this permanently while tracking. It is not optional, so it
    // may as well say something honest about why the app is doing it.
    foregroundService: {
      notificationTitle: 'Food-Dash — delivery in progress',
      notificationBody: 'Sharing your location with the customer.',
      notificationColor: '#D85A30',
    },
  });
  return true;
}

/**
 * Stops reporting.
 *
 * Called on handover and on sign-out. The database also stops accepting
 * positions once the delivery is done — report_rider_location() only writes to
 * orders that are still in progress — so a late fix in flight is harmless, but
 * a rider should not be followed home either way.
 */
export async function stopTracking() {
  if (!(await isTracking())) return;
  try {
    await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    // Already stopped, or the task was never registered on this launch.
  }
}
