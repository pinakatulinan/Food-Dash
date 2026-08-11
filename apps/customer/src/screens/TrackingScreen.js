import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import {
  CoralHeader, HeaderStatusPill, Card, TextLink, ConfirmDialog,
} from '@food-dash/ui';
import { colors, spacing, typography, radius } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import {
  fetchOrder, subscribeToOrder, ORDER_STEPS as STEPS, stepFor, statusLabel,
  fetchRiderContact, cancelOrder, isCancellable,
} from '../lib/orders';
import { Loading, EmptyState } from '../components/states';

function subtitleFor(order) {
  if (order.deliveryStatus === 'assigned') return 'A rider is on the way to the restaurant';
  if (order.status === 'ready_for_pickup') return 'Waiting for a rider to collect it';
  return null;
}

export default function TrackingScreen({ route, navigation }) {
  const { orderId, orderNumber, quotedTotalCents } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [rider, setRider] = useState(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const load = useCallback(async () => {
    try {
      setOrder(await fetchOrder(orderId));
    } catch (e) {
      setError(e.message);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Live: the restaurant confirming or a rider picking up updates this screen
  // with no polling and no refresh.
  useEffect(() => subscribeToOrder(orderId, load), [orderId, load]);

  // Rider details only exist between assignment and handover, so this is
  // re-asked as the delivery moves rather than fetched once. A null answer is
  // the normal case for most of an order's life, not a failure.
  const deliveryStatus = order?.deliveryStatus;
  useEffect(() => {
    let active = true;
    if (deliveryStatus !== 'assigned' && deliveryStatus !== 'picked_up') {
      setRider(null);
      return undefined;
    }
    fetchRiderContact(orderId)
      .then((contact) => { if (active) setRider(contact); })
      .catch(() => { if (active) setRider(null); });
    return () => { active = false; };
  }, [orderId, deliveryStatus]);

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(orderId);
      setConfirmingCancel(false);
      await load();
    } catch (e) {
      // The database is the authority on whether cancelling is still allowed.
      // If the kitchen accepted a second ago, this is where the customer finds
      // out — which is why the message is shown rather than swallowed.
      setCancelError(e.message);
    }
    setCancelling(false);
  };

  const header = (children) => (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Restaurants', onPress: () => navigation.popToTop() }}
        title={`Order #${orderNumber}`}
      >
        {order ? <HeaderStatusPill label={statusLabel(order)} /> : null}
      </CoralHeader>
      {children}
    </View>
  );

  if (error) return header(<EmptyState title="Couldn't load this order" detail={error} />);
  if (!order) return header(<Loading />);

  if (order.status === 'cancelled') {
    return header(
      <View style={styles.body}>
        <Card>
          <Text style={styles.cancelled}>This order was cancelled.</Text>
          {order.cancellationReason ? (
            <Text style={styles.cancelledDetail}>{order.cancellationReason}</Text>
          ) : null}
        </Card>
      </View>,
    );
  }

  const step = stepFor(order);
  const subtitle = subtitleFor(order);
  // The basket total was an estimate; the database re-prices as it writes.
  // Only worth saying anything when the two actually disagree.
  const totalMoved =
    quotedTotalCents != null && quotedTotalCents !== order.totalCents;

  return header(
    <View style={styles.body}>
      <Card>
        <Text style={styles.restaurant}>{order.restaurant}</Text>
        <Text style={styles.total}>{formatMoney(order.totalCents)} · cash on delivery</Text>
        {totalMoved ? (
          <Text style={styles.repriced}>
            Prices changed while you were ordering — this was
            {' '}{formatMoney(quotedTotalCents)} in your basket.
          </Text>
        ) : null}
      </Card>

      {rider ? (
        <Card>
          <Text style={styles.riderLabel}>Your rider</Text>
          <Text style={styles.riderName}>{rider.name}</Text>
          {rider.phone ? (
            <TextLink
              label={`Call ${rider.phone}`}
              onPress={() => Linking.openURL(`tel:${rider.phone}`)}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepRow}>
            <View
              style={[
                styles.dot,
                i < step && styles.dotDone,
                i === step && styles.dotActive,
              ]}
            />
            <Text style={i === step ? styles.stepActive : styles.stepMuted}>{label}</Text>
          </View>
        ))}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Card>

      {/* Only before the kitchen accepts. After that it's the restaurant's
          call, because food may already be cooking — cancel_order() enforces
          the same rule, so this only decides whether to offer the button. */}
      {isCancellable(order) ? (
        <TextLink label="Cancel order" onPress={() => setConfirmingCancel(true)} />
      ) : null}

      <ConfirmDialog
        visible={confirmingCancel}
        title="Cancel this order?"
        message="The restaurant hasn't accepted it yet, so you can still call it off."
        confirmLabel="Cancel order"
        busy={cancelling}
        error={cancelError}
        onConfirm={doCancel}
        onCancel={() => { setConfirmingCancel(false); setCancelError(null); }}
      />
    </View>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { padding: spacing.screenPadding, gap: spacing.md },
  restaurant: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  total: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  repriced: { marginTop: spacing.xs, fontSize: typography.caption, color: colors.coralDeep },
  riderLabel: { fontSize: typography.pill, color: colors.textMuted },
  riderName: {
    marginTop: 2,
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surfaceMuted },
  dotDone: { backgroundColor: colors.mintPastel },
  dotActive: { backgroundColor: colors.coralDeep },
  stepActive: { fontSize: typography.caption, fontWeight: '500', color: colors.textPrimary },
  stepMuted: { fontSize: typography.caption, color: colors.textMuted },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  cancelled: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  cancelledDetail: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
