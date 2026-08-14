import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatMoney, pesos } from '@food-dash/money';
import {
  fetchMenu, saveMenuItem, setItemAvailable, uploadImage, updateRestaurant,
} from './lib/dashboard';
import Hours from './Hours';

// The menu editor.
//
// Everything a kitchen changes day to day — a price, a photo, running out of
// pork — used to be a SQL statement someone had to type for them. This is that
// job handed back to the people who actually know the answer.

const BLANK = {
  category: '', name: '', description: '', price: '', imageUrl: null,
};

/** Centavos are the storage format; a human types pesos. */
function priceToCents(text) {
  const value = Number.parseFloat(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? pesos(value) : null;
}

export default function Menu({ restaurant, onRestaurantChange }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchMenu(restaurant.id));
    } catch (e) {
      setError(e.message);
    }
  }, [restaurant.id]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const byCat = {};
    (items ?? []).forEach((i) => { (byCat[i.category] ||= []).push(i); });
    return Object.entries(byCat);
  }, [items]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const changeBanner = async (file) => {
    await run(async () => {
      const imageUrl = await uploadImage(restaurant.id, file);
      const updated = await updateRestaurant(restaurant.id, { image_url: imageUrl });
      onRestaurantChange(updated);
    });
  };

  if (!items) return <p className="hint">Loading your menu…</p>;

  return (
    <div className="menu">
      {error && <p className="error">{error}</p>}

      <section className="menu-banner">
        <ImagePicker
          url={restaurant.image_url}
          label="restaurant photo"
          onPick={changeBanner}
          wide
        />
        <div>
          <h2>Your restaurant photo</h2>
          <p className="hint">
            Shown at the top of your page in the customer app. A wide photo of
            the food or the shopfront works best.
          </p>
        </div>
      </section>

      <Hours restaurantId={restaurant.id} />

      {categories.map(([category, dishes]) => (
        <section className="menu-section" key={category}>
          <h2>{category}</h2>
          {dishes.map((item) => (
            <DishRow
              key={item.id}
              item={item}
              restaurantId={restaurant.id}
              busy={busy}
              onSave={(patch) => run(() => saveMenuItem(restaurant.id, { ...item, ...patch }))}
              onToggle={() => run(() => setItemAvailable(item.id, !item.isAvailable))}
            />
          ))}
        </section>
      ))}

      {items.length === 0 && (
        <p className="hint">
          No dishes yet. Add your first one below and it appears in the customer
          app straight away.
        </p>
      )}

      {adding ? (
        <section className="menu-section">
          <h2>New dish</h2>
          <DishRow
            item={null}
            draft={adding}
            restaurantId={restaurant.id}
            busy={busy}
            onSave={(patch) => run(async () => {
              await saveMenuItem(restaurant.id, {
                ...patch,
                isAvailable: true,
                sortOrder: items.length,
              });
              setAdding(null);
            })}
            onCancel={() => setAdding(null)}
          />
        </section>
      ) : (
        <button className="cta add-dish" onClick={() => setAdding(BLANK)}>
          Add a dish
        </button>
      )}
    </div>
  );
}

/**
 * One dish.
 *
 * Edits are held locally and only written when Save is pressed, so a
 * half-typed price never reaches the customer app — and Save only lights up
 * once something has actually changed.
 */
function DishRow({ item, draft, restaurantId, busy, onSave, onToggle, onCancel }) {
  const initial = item
    ? {
        category: item.category,
        name: item.name,
        description: item.description ?? '',
        price: (item.priceCents / 100).toFixed(2),
        imageUrl: item.imageUrl,
      }
    : draft;

  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Re-sync when the row is reloaded from the server after a save.
  useEffect(() => { setForm(initial); }, [item?.id, item?.priceCents, item?.imageUrl]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const cents = priceToCents(form.price);
  const valid = form.name.trim() && cents !== null && cents >= 0;

  const pickImage = async (file) => {
    setUploading(true);
    setLocalError(null);
    try {
      const imageUrl = await uploadImage(restaurantId, file);
      setForm((f) => ({ ...f, imageUrl }));
    } catch (e) {
      setLocalError(e.message);
    }
    setUploading(false);
  };

  return (
    <article className={`dish ${item && !item.isAvailable ? 'dish-off' : ''}`}>
      <ImagePicker
        url={form.imageUrl}
        label={form.name || 'dish'}
        onPick={pickImage}
        uploading={uploading}
      />

      <div className="dish-fields">
        <div className="dish-line">
          <label className="field grow">
            <span>Dish name</span>
            <input value={form.name} onChange={set('name')} placeholder="Pork sisig" />
          </label>
          <label className="field price">
            <span>Price (₱)</span>
            <input
              value={form.price}
              onChange={set('price')}
              inputMode="decimal"
              placeholder="129.00"
            />
          </label>
          <label className="field">
            <span>Section</span>
            <input
              value={form.category}
              onChange={set('category')}
              placeholder="Silog meals"
            />
          </label>
        </div>

        <label className="field">
          <span>Description (optional)</span>
          <input
            value={form.description}
            onChange={set('description')}
            placeholder="Crispy pork, onions, egg on top"
          />
        </label>

        {localError && <p className="error">{localError}</p>}

        <div className="dish-actions">
          <button
            className="cta compact"
            disabled={busy || uploading || !dirty || !valid}
            onClick={() => onSave({
              category: form.category,
              name: form.name,
              description: form.description,
              priceCents: cents,
              imageUrl: form.imageUrl,
            })}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </button>

          {item ? (
            <button className="link" disabled={busy} onClick={onToggle}>
              {/* Hidden, not deleted — a dish that comes back next week should
                  be the same row, and this is reversible by the same person. */}
              {item.isAvailable ? 'Mark sold out' : 'Put back on the menu'}
            </button>
          ) : (
            <button className="link" onClick={onCancel}>Cancel</button>
          )}

          {item && !item.isAvailable && (
            <span className="pill muted">Sold out — hidden from customers</span>
          )}
          {item && (
            <span className="hint price-hint">{formatMoney(item.priceCents)}</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** A photo, or a prompt to add one. The whole tile is the file picker. */
function ImagePicker({ url, label, onPick, uploading, wide }) {
  return (
    <label className={`image-picker ${wide ? 'wide' : ''}`}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file twice still fires a change event.
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
      {url ? <img src={url} alt={label} /> : <span>Add photo</span>}
      {uploading && <span className="uploading">Uploading…</span>}
    </label>
  );
}
