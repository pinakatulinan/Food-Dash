import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import {
  StatusPill, ErrorText, QtyStepper, SelectRow, ScreenHeader, Button, Input,
} from '@food-dash/ui';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { placeOrder } from '../lib/orders';
import { fetchMenu } from '../lib/catalog';
import { fetchAddresses, createAddress } from '../lib/addresses';
import { fetchMyProfile, updateMyPhone, isUsablePhone } from '../lib/profile';
import { useCart } from '../lib/cart';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';
import LocationPicker from '../components/LocationPicker';

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
  // Where the food actually goes. A typed address is words; this is a place.
  const [pin, setPin] = useState(null);

  const addressState = useAsync(fetchAddresses);
  const addresses = addressState.data;

  // Accounts created before signup asked for a number have none, and those are
  // exactly the accounts in the pilot. Rather than leave them permanently
  // uncontactable, the number is collected here — at the one moment it's
  // obviously relevant, because a rider is about to come to your house.
  const profileState = useAsync(fetchMyProfile);
  const [phone, setPhone] = useState('');
  const needsPhone = profileState.data != null && !isUsablePhone(profileState.data.phone);

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
  // A saved address carries its own pin. Addresses saved before migration 015
  // have none, so those fall back to the picker like a new one.
  const coords = selectedId === NEW_ADDRESS
    ? pin
    : (chosen?.lat != null ? { lat: chosen.lat, lng: chosen.lng } : pin);
  const addressText = selectedId === NEW_ADDRESS ? newAddress : (chosen?.address ?? '');

  /**
   * What gets stored as the written address.
   *
   * place_order() requires a non-empty one, and it should: a rider standing on
   * the right street still needs to know which gate. But when a pin has been
   * dropped, insisting the customer also type something is friction for no
   * gain — the exact spot is already known. So an unwritten address becomes a
   * readable stand-in, and the pin does the navigating.
   */
  const deliveryAddress = addressText.trim()
    || (coords ? `Pinned location (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})` : '');
  const canDeliver = deliveryAddress.length > 0;
  const deliveryFeeCents = restaurant?.deliveryFeeCents ?? 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  const submit = async () => {
    setPlacing(true);
    setError(null);
    try {
      // Saved before the order, and awaited unlike the address below: an order
      // that exists with no way to reach the customer is the thing this is
      // here to prevent, so it must not be best-effort.
      if (needsPhone) {
        await updateMyPhone(profileState.data.id, phone);
      }

      if (selectedId === NEW_ADDRESS && saveForNextTime) {
        // Saving is a convenience, not part of ordering. If it fails the order
        // should still go through, so it is deliberately not awaited into the
        // same try/catch outcome as placeOrder.
        createAddress({
          label: newLabel,
          address: deliveryAddress,
          notes: null,
          makeDefault: false,
          lat: pin?.lat,
          lng: pin?.lng,
        }).catch(() => {});
      }

      const order = await placeOrder({
        restaurant, cart: items, address: deliveryAddress, notes, coords,
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

  // One header for every branch of this screen — loading, empty, and the real
  // thing. It used to be declared twice, which is how the two drifted apart.
  const header = (children) => (
    <View style={styles.screen}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
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
        icon="basket-outline"
        detail="Add something from a restaurant menu and it'll show up here."
      />,
    );
  }

  if (menuState.loading || addressState.loading || profileState.loading) {
    return header(<Loading />);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        onBack={() => navigation.goBack()}
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

        {needsPhone ? (
          <View style={styles.phoneBlock}>
            <Text style={styles.sectionLabel}>Your mobile number</Text>
            <Text style={styles.phoneHint}>
              Your rider will call this if they can't find your address.
            </Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="0917 123 4567"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          </View>
        ) : null}

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

        {selectedId === NEW_ADDRESS || (chosen && chosen.lat == null) ? (
          <View style={styles.newAddress}>
            {/* Without this the rider only gets text, and the customer's own
                tracking map can only measure against the restaurant. */}
            <Text style={styles.pinLabel}>Pin your exact location</Text>
            <LocationPicker value={coords} onChange={setPin} />
            <Input
              label={pin ? 'Address or landmark (optional)' : 'Address'}
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder={pin ? 'Blue gate, second floor…' : 'House no., street, barangay'}
              autoCapitalize="words"
            />
            {pin ? (
              <Text style={styles.pinnedNote}>
                You've pinned the spot, so this is optional — but a landmark
                helps your rider find the right door.
              </Text>
            ) : null}
            <Input
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
          <Input
            label="Notes for the rider (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Landmark, gate colour, call on arrival…"
            multiline
          />
        </View>

        <Text style={styles.payment}>Payment: cash on delivery</Text>

        <ErrorText>{error}</ErrorText>

        <Button
          label={placing ? 'Placing order…' : 'Place order'}
          onPress={submit}
          disabled={
            placing || !canDeliver || isEmpty ||
            (needsPhone && !isUsablePhone(phone))
          }
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
  screen: { flex: 1, backgroundColor: browse.pageBg },
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
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  phoneBlock: { marginBottom: spacing.lg },
  phoneHint: {
    marginBottom: spacing.sm,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  newAddress: { marginTop: spacing.md },
  pinnedNote: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },
  pinLabel: {
    marginBottom: spacing.xs,
    fontSize: typography.pill,
    color: colors.textMuted,
  },
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
    backgroundColor: browse.sectionBg,
    borderRadius: radius.lg,
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