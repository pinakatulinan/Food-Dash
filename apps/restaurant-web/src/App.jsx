import React, { useState, useEffect, useCallback } from 'react';
import { formatMoney } from '@food-dash/money';
import { supabase } from './lib/supabase';
import { useSession } from './lib/useSession';
import {
  fetchMyRestaurant, setOpen, fetchOrders, advanceOrder, rejectOrder,
  subscribeToOrders,
} from './lib/dashboard';
import Login from './Login';

// Columns are the kitchen's lifecycle. Once an order is ready_for_pickup it
// belongs to the rider, so this dashboard stops acting on it.
const COLUMNS = [
  { status: 'pending', label: 'New orders', cta: 'Accept order' },
  { status: 'confirmed', label: 'Accepted', cta: 'Start preparing' },
  { status: 'preparing', label: 'Preparing', cta: 'Mark ready for pickup' },
  { status: 'ready_for_pickup', label: 'Waiting for rider', cta: null },
];

const DELIVERY_LABEL = {
  unassigned: 'No rider yet',
  assigned: 'Rider on the way',
  picked_up: 'Picked up',
  delivered: 'Delivered',
};

export default function App() {
  const { session, loading } = useSession();

  if (loading) return <main className="login"><p className="hint">Loading…</p></main>;
  if (!session) return <Login />;
  return <Dashboard userId={session.user.id} />;
}

function Dashboard({ userId }) {
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadOrders = useCallback(async (restaurantId) => {
    try {
      setOrders(await fetchOrders(restaurantId));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mine = await fetchMyRestaurant(userId);
        if (!active) return;
        setRestaurant(mine);
        if (mine) await loadOrders(mine.id);
      } catch (e) {
        if (active) setError(e.message);
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, [userId, loadOrders]);

  // Live updates: a new order, or a rider claiming one, arrives without a
  // refresh. The kitchen isn't going to sit pressing F5.
  useEffect(() => {
    if (!restaurant) return;
    return subscribeToOrders(restaurant.id, () => loadOrders(restaurant.id));
  }, [restaurant, loadOrders]);

  const act = async (id, fn) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await loadOrders(restaurant.id);
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  const toggleOpen = async () => {
    setError(null);
    try {
      await setOpen(restaurant.id, !restaurant.is_open);
      setRestaurant({ ...restaurant, is_open: !restaurant.is_open });
    } catch (e) {
      setError(e.message);
    }
  };

  if (!ready) return <main className="login"><p className="hint">Loading…</p></main>;

  if (!restaurant) {
    return (
      <>
        <header className="header">
          <h1>No restaurant linked</h1>
          <p>Restaurant dashboard</p>
        </header>
        <main className="login">
          <div className="card">
            <p className="hint">
              This account isn’t the owner of any restaurant. Ask the Food-Dash team
              to link it, then reload.
            </p>
            <button className="cta secondary" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-row">
          <div>
            <h1>{restaurant.name}</h1>
            <p>Restaurant dashboard</p>
          </div>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
        <button className="toggle" onClick={toggleOpen}>
          {restaurant.is_open ? 'Open — accepting orders' : 'Closed — click to open'}
        </button>
      </header>

      {error && <p className="error banner">{error}</p>}

      <main className="main">
        {COLUMNS.map(({ status, label, cta }) => {
          const inColumn = orders.filter((o) => o.status === status);
          return (
            <section className="col" key={status}>
              <h2>{label} {inColumn.length > 0 && `(${inColumn.length})`}</h2>
              {inColumn.map((o) => (
                <article className="card" key={o.id}>
                  <div className="row">
                    <span className="num">Order #{o.number}</span>
                    <span className="pill">{formatMoney(o.subtotalCents)}</span>
                  </div>
                  <div className="items">
                    {o.items.map((i) => (
                      <div key={i.name}>
                        <span>{i.qty}x {i.name}</span>
                        <span>{formatMoney(i.lineTotalCents)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="meta">To: {o.dropoff}</p>
                  {o.notes && <p className="meta">Note: {o.notes}</p>}
                  <p className="meta">
                    You earn {formatMoney(o.payoutCents)} · {DELIVERY_LABEL[o.deliveryStatus]}
                  </p>

                  {cta && (
                    <button
                      className="cta"
                      disabled={busyId === o.id}
                      onClick={() => act(o.id, () => advanceOrder(o.id))}
                    >
                      {busyId === o.id ? 'Working…' : cta}
                    </button>
                  )}
                  {status === 'pending' && (
                    <button
                      className="cta secondary"
                      disabled={busyId === o.id}
                      onClick={() => act(o.id, () => rejectOrder(o.id, 'Restaurant declined'))}
                    >
                      Reject
                    </button>
                  )}
                </article>
              ))}
              {inColumn.length === 0 && <p className="hint">Nothing here</p>}
            </section>
          );
        })}
      </main>
    </>
  );
}
