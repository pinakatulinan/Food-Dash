import React, { useState, useEffect, useCallback } from 'react';
import { formatMoney, pesos } from '@food-dash/money';
import {
  fetchPeople, setRiderStatus, fetchRestaurants, linkOwner, createRestaurant,
} from './lib/admin';

// The jobs that used to mean opening the SQL editor: approving a rider so they
// can start working, and pointing a restaurant at the account that runs it.
//
// Both are gates rather than settings. A rider carries a stranger's food and,
// on cash orders, your money — so approval is a decision someone makes, and
// the database keeps it that way whatever this screen does.

const RIDER_STATUS_LABEL = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  suspended: 'Suspended',
};

export default function Admin() {
  const [people, setPeople] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([fetchPeople(), fetchRestaurants()]);
      setPeople(p);
      setRestaurants(r);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(null);
  };

  const riders = (people ?? []).filter((p) => p.role === 'rider');
  const waiting = riders.filter((r) => r.riderStatus === 'pending');

  if (!people) return <p className="hint">Loading…</p>;

  return (
    <div className="admin">
      {error && <p className="error">{error}</p>}

      <section className="menu-section">
        <h2>
          Riders
          {waiting.length > 0 && (
            <span className="pill">{waiting.length} waiting</span>
          )}
        </h2>

        {riders.length === 0 && <p className="hint">No riders have signed up yet.</p>}

        {riders.map((r) => (
          <article className="card admin-row" key={r.id}>
            <div className="admin-who">
              <span className="num">{r.fullName || '(no name)'}</span>
              <span className="meta">{r.email}</span>
              <span className="meta">{r.phone || 'No phone on file'}</span>
            </div>

            <div className="admin-state">
              <span className={r.riderStatus === 'approved' ? 'pill' : 'pill muted'}>
                {RIDER_STATUS_LABEL[r.riderStatus] ?? r.riderStatus}
              </span>
              {r.isOnline && <span className="meta">Online now</span>}
            </div>

            <div className="admin-actions">
              {r.riderStatus !== 'approved' ? (
                <button
                  className="cta compact"
                  disabled={busy === r.id}
                  onClick={() => run(r.id, () => setRiderStatus(r.id, 'approved'))}
                >
                  Approve
                </button>
              ) : (
                <button
                  className="cta compact secondary"
                  disabled={busy === r.id}
                  onClick={() => run(r.id, () => setRiderStatus(r.id, 'suspended'))}
                >
                  Suspend
                </button>
              )}
            </div>
          </article>
        ))}
        <p className="hint">
          {/* Worth saying, because it is the reason suspending is safe to do
              mid-shift rather than something to schedule. */}
          A rider cannot go online until approved, and suspending takes them
          offline straight away.
        </p>
      </section>

      <section className="menu-section">
        <h2>Restaurants</h2>

        {(restaurants ?? []).map((r) => (
          <RestaurantRow
            key={r.id}
            restaurant={r}
            busy={busy === r.id}
            onLink={(email) => run(r.id, () => linkOwner(r.id, email))}
          />
        ))}

        {creating ? (
          <NewRestaurant
            busy={busy === 'new'}
            onCancel={() => setCreating(false)}
            onCreate={(values) => run('new', async () => {
              await createRestaurant(values);
              setCreating(false);
            })}
          />
        ) : (
          <button className="cta add-dish" onClick={() => setCreating(true)}>
            Add a restaurant
          </button>
        )}
      </section>
    </div>
  );
}

function RestaurantRow({ restaurant, busy, onLink }) {
  const [email, setEmail] = useState('');

  return (
    <article className="card admin-row">
      <div className="admin-who">
        <span className="num">{restaurant.name}</span>
        <span className="meta">
          {Math.round(restaurant.commissionRate * 100)}% commission ·{' '}
          {formatMoney(restaurant.deliveryFeeCents)} delivery
        </span>
      </div>

      <div className="admin-state">
        {restaurant.ownerEmail ? (
          <span className="meta">Owner: {restaurant.ownerEmail}</span>
        ) : (
          <span className="pill muted">No owner linked</span>
        )}
      </div>

      {!restaurant.ownerEmail && (
        <div className="admin-actions wide">
          <label className="field">
            <span>Owner's email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </label>
          <button
            className="cta compact"
            disabled={busy || !email.trim()}
            onClick={() => onLink(email)}
          >
            Link owner
          </button>
          {/* The most common failure, said before it happens rather than as
              an error afterwards. */}
          <p className="hint">They must have signed up in the app first.</p>
        </div>
      )}
    </article>
  );
}

function NewRestaurant({ busy, onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [commission, setCommission] = useState('10');
  const [fee, setFee] = useState('29.00');

  const valid = name.trim() && address.trim();

  return (
    <article className="card">
      <div className="dish-line">
        <label className="field grow">
          <span>Restaurant name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nang Inday's Kitchen" />
        </label>
        <label className="field grow">
          <span>Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Barangay, city" />
        </label>
      </div>
      <div className="dish-line">
        <label className="field price">
          <span>Commission %</span>
          <input value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" />
        </label>
        <label className="field price">
          <span>Delivery fee (₱)</span>
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <p className="hint">
        Commercial terms, so they're set here and the restaurant can't change
        them later. Both are snapshotted onto every order anyway, so changing
        them never rewrites what an old order paid out.
      </p>
      <div className="dish-actions">
        <button
          className="cta compact"
          disabled={busy || !valid}
          onClick={() => onCreate({
            name,
            address,
            commissionRate: Number(commission) / 100,
            deliveryFeeCents: pesos(Number(fee)),
          })}
        >
          Create restaurant
        </button>
        <button className="link" onClick={onCancel}>Cancel</button>
      </div>
    </article>
  );
}
