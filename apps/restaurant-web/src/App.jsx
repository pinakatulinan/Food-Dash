import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatMoney } from '@food-dash/money';
import { supabase } from './lib/supabase';
import { useSession } from './lib/useSession';
import {
  fetchMyRestaurant, setOpen, fetchOrders, advanceOrder, rejectOrder,
  subscribeToOrders,
} from './lib/dashboard';
import { enableAlerts, alertsReady, startAlerting, stopAlerting } from './lib/alerts';
import { isAdmin } from './lib/admin';
import Login from './Login';
import Menu from './Menu';
import History from './History';
import Admin from './Admin';

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
  const [tab, setTab] = useState('orders');
  // Asked of the database rather than inferred from anything the client holds.
  // Hiding the tab is only tidiness — every admin function checks the caller
  // again, so a forged `true` here would still be refused.
  const [admin, setAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [alertsOn, setAlertsOn] = useState(alertsReady());
  // Which pending orders we've already sounded for, so a refetch caused by a
  // rider claiming some other order doesn't set the alarm off again.
  const alerted = useRef(new Set());

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

  // Alerting is driven by what's on the board, not by realtime events — a
  // dropped socket or a manual refetch both end up here, so the alarm state
  // always matches what a person would see rather than what arrived over the
  // wire. Sounds once per new order, then repeats while any sit unaccepted.
  useEffect(() => {
    const pending = orders.filter((o) => o.status === 'pending');
    const pendingIds = pending.map((o) => o.id);

    if (pendingIds.length === 0) {
      stopAlerting();
      alerted.current.clear();
      document.title = 'Food-Dash';
      return;
    }

    // Visible even when the tab is in the background and the sound was denied.
    document.title = `(${pendingIds.length}) New order — Food-Dash`;

    const fresh = pendingIds.filter((id) => !alerted.current.has(id));
    if (fresh.length) {
      fresh.forEach((id) => alerted.current.add(id));
      startAlerting(pendingIds.length);
    }
  }, [orders]);

  // Stop the timer if the dashboard is closed mid-alarm.
  useEffect(() => stopAlerting, []);

  useEffect(() => {
    let active = true;
    isAdmin()
      .then((yes) => { if (active) setAdmin(yes); })
      .finally(() => { if (active) setAdminChecked(true); });
    return () => { active = false; };
  }, [userId]);

  const turnOnAlerts = async () => {
    const { sound, notifications } = await enableAlerts();
    setAlertsOn(sound);
    if (!notifications) {
      setError(
        'Sound is on, but desktop notifications were blocked. Allow them in your browser to get alerts when this window is behind something else.',
      );
    }
  };

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
      // Take the row the database actually wrote rather than assuming the flip
      // worked. Before migration 009 there was no update policy here, so this
      // silently changed nothing and only local state moved.
      setRestaurant(await setOpen(restaurant.id, !restaurant.is_open));
    } catch (e) {
      setError(e.message);
    }
  };

  // Waits for the admin answer too, or an admin with no restaurant would see
  // the "no restaurant linked" dead end flash before being corrected.
  if (!ready || !adminChecked) {
    return <main className="login"><p className="hint">Loading…</p></main>;
  }

  // An admin normally owns no restaurant — running the platform and running a
  // kitchen are different jobs. Without this they'd hit the "no restaurant"
  // dead end below and never reach the admin screen at all.
  if (!restaurant && admin) {
    return (
      <>
        <header className="header">
          <div className="header-row">
            <div>
              <h1>Food-Dash</h1>
              <p>Platform admin</p>
            </div>
            <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </header>
        <main className="main single">
          <Admin />
        </main>
      </>
    );
  }

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
        <button
          className={restaurant.is_open ? 'toggle' : 'toggle off'}
          onClick={toggleOpen}
        >
          {restaurant.is_open ? 'Open — accepting orders' : 'Closed — click to open'}
        </button>
        <nav className="tabs">
          <button
            className={tab === 'orders' ? 'tab on' : 'tab'}
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
          <button
            className={tab === 'menu' ? 'tab on' : 'tab'}
            onClick={() => setTab('menu')}
          >
            Menu
          </button>
          <button
            className={tab === 'history' ? 'tab on' : 'tab'}
            onClick={() => setTab('history')}
          >
            History
          </button>
          {admin && (
            <button
              className={tab === 'admin' ? 'tab on' : 'tab'}
              onClick={() => setTab('admin')}
            >
              Admin
            </button>
          )}
        </nav>
      </header>

      {/* Browsers refuse to play sound until someone has clicked the page, so
          this cannot be armed automatically — and a dashboard that thinks it
          is alerting when it is silent is worse than one that never claimed to. */}
      {!alertsOn && (
        <div className="alert-bar">
          <span>Alerts are off — you won't hear new orders arrive.</span>
          <button className="cta compact" onClick={turnOnAlerts}>Turn on alerts</button>
        </div>
      )}

      {error && <p className="error banner">{error}</p>}

      {tab === 'menu' ? (
        <main className="main single">
          <Menu restaurant={restaurant} onRestaurantChange={setRestaurant} />
        </main>
      ) : tab === 'history' ? (
        <main className="main single">
          <History restaurant={restaurant} />
        </main>
      ) : tab === 'admin' ? (
        <main className="main single">
          <Admin />
        </main>
      ) : (
      <main className="main">
        {COLUMNS.map(({ status, label, cta }) => {
          const inColumn = orders.filter((o) => o.status === status);
          const urgent = status === 'pending' && inColumn.length > 0;
          return (
            <section className={urgent ? 'col urgent' : 'col'} key={status}>
              <h2>
                {label}
                {inColumn.length > 0 && (
                  <span className="col-count">{inColumn.length}</span>
                )}
              </h2>
              {inColumn.map((o) => (
                <article className={status === 'pending' ? 'card new' : 'card'} key={o.id}>
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
      )}
    </>
  );
}
