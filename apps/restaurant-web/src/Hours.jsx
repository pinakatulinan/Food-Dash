import React, { useState, useEffect, useCallback } from 'react';
import { fetchHours, saveHours, WEEKDAYS } from './lib/dashboard';

// Opening hours, so "are we open" stops being something a person has to
// remember to click twice a day.
//
// The switch in the header still matters — it's how you close early because
// you ran out of pork. These hours are the normal week; the switch is the
// exception. Both have to be true for customers to be able to order.

const DEFAULT = { opensAt: '08:00', closesAt: '20:00' };

export default function Hours({ restaurantId }) {
  const [byDay, setByDay] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const hours = await fetchHours(restaurantId);
      setByDay(hours);
      setSaved(JSON.stringify(hours));
    } catch (e) {
      setError(e.message);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  if (!byDay) return <p className="hint">Loading hours…</p>;

  const dirty = JSON.stringify(byDay) !== saved;

  const toggleDay = (day) => {
    setByDay((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      // A newly ticked day copies the previous day's times where there is one,
      // because a week is usually the same hours repeated.
      else next[day] = prev[(day + 6) % 7] ?? DEFAULT;
      return next;
    });
  };

  const setTime = (day, field, value) =>
    setByDay((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveHours(restaurantId, byDay);
      setSaved(JSON.stringify(byDay));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const openDays = Object.keys(byDay).length;

  return (
    <section className="menu-section">
      <h2>Opening hours</h2>
      {error && <p className="error">{error}</p>}

      {WEEKDAYS.map(({ day, label }) => {
        const hours = byDay[day];
        return (
          <article className="card hours-row" key={day}>
            <label className="hours-day">
              <input
                type="checkbox"
                checked={Boolean(hours)}
                onChange={() => toggleDay(day)}
              />
              <span>{label}</span>
            </label>

            {hours ? (
              <div className="hours-times">
                <input
                  type="time"
                  value={hours.opensAt}
                  onChange={(e) => setTime(day, 'opensAt', e.target.value)}
                />
                <span className="meta">to</span>
                <input
                  type="time"
                  value={hours.closesAt}
                  onChange={(e) => setTime(day, 'closesAt', e.target.value)}
                />
                {/* Closing before opening means the session runs past midnight
                    — normal for a night place, and worth confirming out loud
                    so it doesn't look like a typo. */}
                {hours.closesAt <= hours.opensAt && (
                  <span className="pill muted">closes after midnight</span>
                )}
              </div>
            ) : (
              <span className="meta">Closed</span>
            )}
          </article>
        );
      })}

      <div className="dish-actions">
        <button className="cta compact" disabled={busy || !dirty} onClick={save}>
          {dirty ? 'Save hours' : 'Saved'}
        </button>
        <span className="hint">
          {openDays === 0
            ? 'No hours set — the switch at the top is the only thing deciding if you are open.'
            : `Open ${openDays} day${openDays === 1 ? '' : 's'} a week. Customers can only order inside these hours, and only while the switch at the top is on.`}
        </span>
      </div>
    </section>
  );
}
