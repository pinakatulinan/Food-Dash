import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatMoney } from '@food-dash/money';
import { fetchHistory, summarise } from './lib/dashboard';

// Past orders and what they came to.
//
// The order board deliberately drops an order the moment it's out the door, so
// until now yesterday was invisible to a restaurant — and "how much did we do
// today?" is the first question any owner asks.

const RANGES = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'week', label: 'Last 7 days', days: 6 },
  { key: 'month', label: 'Last 30 days', days: 29 },
];

/**
 * Start of the local day, N days back.
 *
 * Local, not UTC: a restaurant in Cebu closing at 11pm expects those orders in
 * today's takings, and a UTC boundary would push the evening into tomorrow.
 */
function startOfDayBefore(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function dayLabel(iso) {
  const date = new Date(iso);
  const today = startOfDayBefore(0);
  const yesterday = startOfDayBefore(1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });
}

export default function History({ restaurant }) {
  const [range, setRange] = useState('today');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setOrders(null);
    setError(null);
    try {
      const days = RANGES.find((r) => r.key === range).days;
      setOrders(await fetchHistory(restaurant.id, startOfDayBefore(days).toISOString()));
    } catch (e) {
      setError(e.message);
    }
  }, [restaurant.id, range]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => summarise(orders ?? []), [orders]);

  // Grouped by day so a week reads as a week rather than one long list.
  const days = useMemo(() => {
    const byDay = new Map();
    (orders ?? []).forEach((o) => {
      const key = dayLabel(o.placedAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(o);
    });
    return [...byDay.entries()];
  }, [orders]);

  return (
    <div className="history">
      <nav className="ranges">
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={range === r.key ? 'range on' : 'range'}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}

      <section className="tiles">
        <Tile label="Orders" value={totals.orders} />
        <Tile label="Food sales" value={formatMoney(totals.grossCents)} />
        <Tile label="You earn" value={formatMoney(totals.payoutCents)} strong />
        <Tile label="Average order" value={formatMoney(totals.averageCents)} />
      </section>

      <p className="hint">
        {/* Said out loud rather than left as a gap between two numbers someone
            would otherwise have to reconcile themselves. */}
        Food sales minus Food-Dash's {formatMoney(totals.commissionCents)} commission.
        {totals.cancelled > 0 && ` ${totals.cancelled} cancelled order${
          totals.cancelled === 1 ? '' : 's'
        } not counted.`}
      </p>

      {orders === null ? (
        <p className="hint">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="hint">No orders in this period.</p>
      ) : (
        days.map(([label, dayOrders]) => (
          <section className="menu-section" key={label}>
            <h2>
              {label}
              <span className="day-total">
                {formatMoney(summarise(dayOrders).payoutCents)}
              </span>
            </h2>
            {dayOrders.map((o) => (
              <article
                className={`card history-row ${o.status === 'cancelled' ? 'dish-off' : ''}`}
                key={o.id}
              >
                <div className="row">
                  <span className="num">Order #{o.number}</span>
                  <span className="pill">{formatMoney(o.payoutCents)}</span>
                </div>
                <p className="meta">
                  {timeLabel(o.placedAt)} ·{' '}
                  {o.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                </p>
                <p className="meta">
                  {o.status === 'cancelled'
                    ? 'Cancelled'
                    : o.deliveryStatus === 'delivered'
                      ? 'Delivered'
                      : 'In progress'}
                  {' · '}food {formatMoney(o.subtotalCents)}
                </p>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function Tile({ label, value, strong }) {
  return (
    <div className={strong ? 'tile strong' : 'tile'}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  );
}
