// New-order alerts for the kitchen.
//
// Realtime already keeps the board fresh, but a fresh board nobody is looking
// at is still a missed order. A kitchen is noisy and the laptop is usually
// behind something, so this does two things at once: a sound that repeats
// while an order sits unaccepted, and a desktop notification that shows even
// when the dashboard isn't the active window.
//
// Both are gated behind a browser permission the staff have to grant, and both
// fail quietly. An alert that throws would take the order board down with it,
// which is far worse than a silent alert.

const BEEP_INTERVAL_MS = 8000;

let audioContext = null;
let repeatTimer = null;

/**
 * Browsers refuse to play audio until the user has interacted with the page,
 * and a suspended AudioContext stays suspended until you resume it inside a
 * real click handler. So this MUST be called from a button press — that is the
 * whole reason the dashboard has an "Enable alerts" button rather than just
 * starting to beep on its own.
 */
export async function enableAlerts() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx && !audioContext) audioContext = new Ctx();
  if (audioContext?.state === 'suspended') await audioContext.resume();

  let notifications = 'denied';
  if ('Notification' in window) {
    notifications =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
  }

  return {
    sound: audioContext?.state === 'running',
    notifications: notifications === 'granted',
  };
}

/** Whether alerts are armed — drives the banner asking staff to turn them on. */
export function alertsReady() {
  const soundOk = audioContext?.state === 'running';
  const notifyOk = !('Notification' in window) || Notification.permission === 'granted';
  return soundOk && notifyOk;
}

/**
 * Two short tones. Generated rather than loaded from a file so there is no
 * asset to bundle, no network request, and nothing to 404 at the exact moment
 * an order arrives.
 */
function beep() {
  if (!audioContext || audioContext.state !== 'running') return;

  [0, 0.18].forEach((offset) => {
    const at = audioContext.currentTime + offset;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, at);

    // Ramped rather than switched, because a square-edged gain change is an
    // audible click on most speakers.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);

    osc.connect(gain).connect(audioContext.destination);
    osc.start(at);
    osc.stop(at + 0.16);
  });
}

function popup(count) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(
      count === 1 ? 'New order' : `${count} orders waiting`,
      {
        body: 'Open the dashboard to accept it.',
        // Same tag every time, so ten orders replace one notification rather
        // than burying the screen in ten of them.
        tag: 'food-dash-new-order',
        renotify: true,
      },
    );
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    // Some browsers throw on the Notification constructor when the page is in
    // an odd state. Never let that reach the order board.
  }
}

/**
 * Starts alerting and keeps going until `stopAlerting()`.
 *
 * Repeating is the point: a single chime during a busy service gets missed,
 * and a missed order is a customer waiting on food nobody is cooking. It stops
 * the moment the order is accepted, so the way to silence it is to do the work.
 */
export function startAlerting(pendingCount) {
  beep();
  popup(pendingCount);

  if (repeatTimer) return;
  repeatTimer = setInterval(beep, BEEP_INTERVAL_MS);
}

export function stopAlerting() {
  if (!repeatTimer) return;
  clearInterval(repeatTimer);
  repeatTimer = null;
}
