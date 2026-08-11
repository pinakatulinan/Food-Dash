import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import {
  CoralHeader, StatusPill, PrimaryButton, Field, ErrorText, QtyStepper,
  SelectRow, TextLink,
} from '@food-dash/ui';
import { colors, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { placeOrder } from '../lib/orders';
import { fetchMenu } from '../lib/catalog';
import { fetchAddresses, createAddress } from '../lib/addresses';
import { useCart } from '../lib/cart';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';

const NEW_ADDRESS = 'new';

export default function CartScreen({ navigation }) {
  const {
    hydrated, restaurant, items, entries, subtotalCents, setQty, clear, reprice,
    isEmpty,
  } = useCart();

  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [changes, setChanges] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saveForNextTime, setSaveForNextTime] = useState(true);

  const addressState = useAsync(fetchAddresses);
  const addresses = addressState.data;

  // Prices move, and a persisted basket can be days old. Re-price against the
  // live menu the moment the basket opens, so what's on screen is what the
  // database will charge. The ref keeps it to once per visit — reprice changes
  // the cart, which would otherwise re-trigger it forever.
  const menuState = useAsync(
    () => (restaurant ? fetchMenu(restaurant.id) : Promise.resolve(null)),
    [restaurant?.id],
  );
  const repriced = useRef(false);

  useEffect(() => {
    if (!menuState.data || repriced.current) return;
    repriced.current = true;
    const result = reprice(menuState.data);
    if (result.removed.length || result.repriced.length) setChanges(result);
  }, [menuState.data, reprice]);

  // Default address wins, otherwise the newest — fetchAddresses already sorts
  // that way, so the first row is the right one to preselect.
  useEffect(() => {
    if (addresses && selectedId === null) {
      setSelectedId(addresses.length ? addresses[0].id : NEW_ADDRESS);
    }
  }, [addresses, selectedId]);

  const chosen = addresses?.find((a) => a.id === selectedId) ?? null;
  const addressText = selectedId === NEW_ADDRESS ? newAddress : (chosen?.address ?? '');
  const deliveryFeeCents = restaurant?.deliveryFeeCents ?? 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  const submit = async () => {
    setPlacing(true);
    setError(null);
    try {
      if (selectedId === NEW_ADDRESS && saveForNextTime) {
        // Saving is a convenience, not part of ordering. If it fails the order
        // should still go through, so it is deliberately not awaited into the
        // same try/catch outcome as placeOrder.
        createAddress({
          label: newLabel,
          address: newAddress,
          notes: null,
          makeDefault: false,
        }).catch(() => {});
      }

      const order = await placeOrder({
        restaurant, cart: items, address: addressText, notes,
      });

      clear();
      navigation.replace('Tracking', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        // The database re-prices everything as it writes the order. Hand the
        // figure the customer actually agreed to across, so the tracking
        // screen can say so if the two disagree.
        quotedTotalCents: totalCents,
      });
    } catch (e) {
      setError(e.message);
      setPlacing(false);
    }
  };

  const header = (children) => (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Menu', onPress: () => navigation.goBack() }}
        title="Your basket"
        subtitle={restaurant ? `From ${restaurant.name}` : undefined}
      />
      {children}
    </View>
  );

  // Checked before `isEmpty`: on a cold start the basket is empty until
  // AsyncStorage answers, and claiming "your basket is empty" for that beat is
  // worse than a spinner.
  if (!hydrated) return header(<Loading />);

  if (isEmpty) {
    return header(
      <EmptyState
        title="Your basket is empty"
        detail="Add something from a restaurant menu and it'll show up here."
      />,
    );
  }

  if (menuState.loading || addressState.loading) return header(<Loading />);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CoralHeader
        back={{ label: 'Menu', onPress: () => navigation.goBack() }}
        title="Your basket"
        subtitle={`From ${restaurant.name}`}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding }}
        keyboardShouldPersistTaps="handled"
      >
        {changes ? <PriceChangeNotice changes={changes} /> : null}

        {entries.map(({ item, qty }) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{formatMoney(item.priceCents)} each</Text>
            </View>
            <QtyStepper
              qty={qty}
              // At one, the minus removes the line rather than going to zero —
              // clearer than a stepper that bottoms out and does nothing.
              decrementLabel={qty === 1 ? '✕' : '−'}
              onDecrement={() => setQty(item.id, qty - 1)}
              onIncrement={() => setQty(item.id, qty + 1)}
            />
            <Text style={styles.lineTotal}>{formatMoney(item.priceCents * qty)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <Row label="Subtotal" value={formatMoney(subtotalCents)} muted />
          <Row label="Delivery fee" value={formatMoney(deliveryFeeCents)} muted />
          <Row label="Total" value={formatMoney(totalCents)} bold />
        </View>

        <Text style={styles.sectionLabel}>Deliver to</Text>
        {addressState.error ? <ErrorText>{addressState.error}</ErrorText> : null}

        {(addresses ?? []).map((a) => (
          <SelectRow
            key={a.id}
            title={a.label || a.address}
            detail={a.label ? a.address : null}
            selected={selectedId === a.id}
            onPress={() => setSelectedId(a.id)}
            trailing={a.isDefault ? <StatusPill label="Default" /> : null}
          />
        ))}
        <SelectRow
          title="Use a new address"
          selected={selectedId === NEW_ADDRESS}
          onPress={() => setSelectedId(NEW_ADDRESS)}
        />

        {selectedId === NEW_ADDRESS ? (
          <View style={styles.newAddress}>
            <Field
              label="Address"
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="House no., street, barangay"
              autoCapitalize="words"
            />
            <Field
              label="Name it (optional)"
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Home, office…"
            />
            <Pressable
              onPress={() => setSaveForNextTime((v) => !v)}
              style={styles.checkRow}
            >
              <View style={[styles.check, saveForNextTime && styles.checkOn]} />
              <Text style={styles.checkLabel}>Save this address for next time</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.notes}>
          <Field
            label="Notes for the rider (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Landmark, gate colour, call on arrival…"
            multiline
          />
        </View>

        <Text style={styles.payment}>Payment: cash on delivery</Text>

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label={placing ? 'Placing order…' : 'Place order'}
          onPress={submit}
          disabled={placing || !addressText.trim() || isEmpty}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Says out loud what re-pricing changed.
 *
 * On cash on delivery the customer hands over physical money at the door, so a
 * total that quietly moved between browsing and checkout becomes an argument
 * with a rider who had nothing to do with it.
 */
function PriceChangeNotice({ changes }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Your basket was updated</Text>
      {changes.repriced.map((c) => (
        <Text key={c.name} style={styles.noticeLine}>
          {c.name} is now {formatMoney(c.toCents)} (was {formatMoney(c.fromCents)})
        </Text>
      ))}
      {changes.removed.map((name) => (
        <Text key={name} style={styles.noticeLine}>
          {name} is no longer available and has been removed
        </Text>
      ))}
    </View>
  );
}

function Row({ label, value, muted, bold }) {
  const color = bold ? colors.textPrimary : muted ? colors.textMuted : colors.textSecondary;
  const fontWeight = bold ? '500' : '400';
  return (
    <View style={styles.totalRow}>
      <Text style={{ color, fontWeight, fontSize: typography.caption + (bold ? 2 : 0) }}>{label}</Text>
      <Text style={{ color, fontWeight, fontSize: typography.caption + (bold ? 2 : 0) }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  itemText: { flex: 1 },
  itemName: { fontSize: typography.body, color: colors.textPrimary },
  itemMeta: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  lineTotal: {
    minWidth: 64, textAlign: 'right',
    fontSize: typography.body, color: colors.textPrimary,
  },
  totals: { paddingVertical: spacing.md, marginBottom: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sectionLabel: {
    fontSize: typography.pill,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  newAddress: { marginTop: spacing.md },
  notes: { marginTop: spacing.md },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, marginBottom: spacing.md,
  },
  check: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  checkOn: { backgroundColor: colors.coralDeep, borderColor: colors.coralDeep },
  checkLabel: { fontSize: typography.caption, color: colors.textSecondary },
  payment: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeTitle: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noticeLine: { fontSize: typography.caption, color: colors.textMuted },
});