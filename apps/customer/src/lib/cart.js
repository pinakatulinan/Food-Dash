import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The basket, owned in one place.
//
// It used to live in RestaurantScreen's useState and travel to the cart as a
// navigation param, which meant the cart screen could read it but never change
// it — no quantity editing — and closing the app lost it. One provider fixes
// both, and stops a mutable object being passed through navigation params,
// which React Navigation warns about because it breaks state restoration.

const STORAGE_KEY = 'food-dash.cart.v1';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // The restaurant is part of the basket, not a separate lookup: a basket is
  // always from exactly one restaurant (multi-restaurant carts are explicitly
  // out of the MVP), so the two can never be out of step.
  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState({});       // { [itemId]: { item, qty } }
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const saved = JSON.parse(raw);
          setRestaurant(saved.restaurant ?? null);
          setItems(saved.items ?? {});
        }
      } catch {
        // A corrupt or unreadable basket is not worth blocking the app for.
        // Worst case the customer adds their items again.
      }
      if (active) setHydrated(true);
    })();
    return () => { active = false; };
  }, []);

  // Guarded on `hydrated`, or the empty initial state races the read and
  // overwrites the stored basket before it has even been loaded.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ restaurant, items }),
    ).catch(() => {});
  }, [hydrated, restaurant, items]);

  const addItem = useCallback((item, fromRestaurant) => {
    setRestaurant(fromRestaurant);
    setItems((prev) => ({
      ...prev,
      [item.id]: { item, qty: (prev[item.id]?.qty ?? 0) + 1 },
    }));
  }, []);

  const setQty = useCallback((itemId, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        const { [itemId]: _removed, ...rest } = prev;
        return rest;
      }
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: { ...prev[itemId], qty } };
    });
  }, []);

  const clear = useCallback(() => {
    setItems({});
    setRestaurant(null);
  }, []);

  /** Throws away whatever was in the basket and starts one at a new restaurant. */
  const startNewBasket = useCallback((item, fromRestaurant) => {
    setRestaurant(fromRestaurant);
    setItems({ [item.id]: { item, qty: 1 } });
  }, []);

  /**
   * Re-prices the basket against a freshly fetched menu.
   *
   * A persisted basket can be days old, and menu prices move. Returns what
   * changed so the screen can say so out loud rather than silently charging a
   * different number — on cash on delivery a surprise at the door is an
   * argument with a rider.
   */
  const reprice = useCallback((menu) => {
    const fresh = new Map(menu.map((m) => [m.id, m]));
    const removed = [];
    const repriced = [];
    const next = {};

    for (const [id, entry] of Object.entries(items)) {
      const current = fresh.get(id);

      // Gone from the menu, or marked unavailable — fetchMenu only returns
      // available items, so absence means the customer cannot order it.
      if (!current) {
        removed.push(entry.item.name);
        continue;
      }

      if (current.priceCents !== entry.item.priceCents) {
        repriced.push({
          name: current.name,
          fromCents: entry.item.priceCents,
          toCents: current.priceCents,
        });
      }

      next[id] = { item: current, qty: entry.qty };
    }

    setItems(next);
    return { removed, repriced };
  }, [items]);

  const value = useMemo(() => {
    const entries = Object.values(items);
    return {
      hydrated,
      restaurant,
      items,
      entries,
      count: entries.reduce((n, e) => n + e.qty, 0),
      subtotalCents: entries.reduce((s, e) => s + e.item.priceCents * e.qty, 0),
      isEmpty: entries.length === 0,
      // A basket already holding another restaurant's food — the caller has to
      // ask before throwing it away.
      isFromAnotherRestaurant: (restaurantId) =>
        entries.length > 0 && restaurant != null && restaurant.id !== restaurantId,
      addItem,
      setQty,
      clear,
      startNewBasket,
      reprice,
    };
  }, [hydrated, restaurant, items, addItem, setQty, clear, startNewBasket, reprice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart must be used inside a CartProvider.');
  return cart;
}