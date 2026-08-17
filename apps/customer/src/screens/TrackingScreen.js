import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  StatusPill, ScreenHeader, Panel, LinkButton, ConfirmSheet,
} from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
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
      <ScreenHeader
        onBack={() => navigation.popToTop()}
        title={`Order #${orderNumber}`}
      >
        {/* Mint stays the status colour — the one part of Style C that still
            holds, and what keeps status from being mistaken for an action. */}
        {order ? <StatusPill label={statusLabel(order)} /> : null}
      </ScreenHeader>
      {children}
    </View>
  );

  if (error) return header(<EmptyState title="Couldn't load this order"
      icon="cloud-offline-outline" detail={error} />);
  if (!order) return header(<Loading />);

  if (order.status === 'cancelled') {
    return header(
      <View style={styles.body}>
        <Panel>
          <Text style={styles.cancelled}>This order was cancelled.</Text>
          {order.cancellationReason ? (
            <Text style={styles.cancelledDetail}>{order.cancellationReason}</Text>
          ) : null}
        </Panel>
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
      <Panel>
        <Text style={styles.restaurant}>{order.restaurant}</Text>
        <Text style={styles.total}>{formatMoney(order.totalCents)} · cash on delivery</Text>
        {totalMoved ? (
          <Text style={styles.repriced}>
            Prices changed while you were ordering — this was
            {' '}{formatMoney(quotedTotalCents)} in your basket.
          </Text>
        ) : null}
      </Panel>

      {rider ? (
        <Panel>
          <Text style={styles.riderLabel}>Your rider</Text>
          <Text style={styles.riderName}>{rider.name}</Text>
          {rider.phone ? (
            <LinkButton
              label={`Call ${rider.phone}`}
              onPress={() => Linking.openURL(`tel:${rider.phone}`)}
            />
          ) : null}
          <LinkButton
            label={`Message ${rider.name}`}
            onPress={() => navigation.navigate('Chat', {
              orderId, orderNumber, peerName: rider.name,
            })}
          />
        </Panel>
      ) : null}

      <Panel>
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepMarker}>
                {/* A tick for what's finished, a filled ring for where the
                    order is now. Three shades of dot asked the customer to
                    decode a legend nobody gave them. */}
                <Ionicons
                  name={done ? 'checkmark-circle' : current ? 'ellipse' : 'ellipse-outline'}
                  size={done ? 20 : current ? 14 : 12}
                  color={
                    done ? colors.tealTextDark
                      : current ? colors.coralDeep
                        : colors.border
                  }
                />
                {/* The line joining the steps stops at the last one. */}
                {i < STEPS.length - 1 ? (
                  <View style={[styles.stepLine, done && styles.stepLineDone]} />
                ) : null}
              </View>
              <Text style={current ? styles.stepActive : done ? styles.stepDone : styles.stepMuted}>
                {label}
              </Text>
            </View>
          );
        })}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Panel>

      {/* Only before the kitchen accepts. After that it's the restaurant's
          call, because food may already be cooking — cancel_order() enforces
          the same rule, so this only decides whether to offer the button. */}
      {isCancellable(order) ? (
        <LinkButton label="Cancel order" onPress={() => setConfirmingCancel(true)} />
      ) : null}

      <ConfirmSheet
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
  screen: { flex: 1, backgroundColor: browse.pageBg },
  body: { padding: spacing.screenPadding, gap: spacing.md },
  restaurant: {
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  total: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  repriced: { marginTop: spacing.xs, fontSize: typography.caption, color: colors.coralDeep },
  riderLabel: { fontSize: typography.pill, color: colors.textMuted },
  riderName: {
    marginTop: 2,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stepMarker: { width: 20, alignItems: 'center' },
  stepLine: {
    width: 2, height: 22, marginVertical: 2,
    backgroundColor: colors.divider,
  },
  stepLineDone: { backgroundColor: colors.mintPastel },
  stepActive: {
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  stepDone: { fontSize: typography.body, color: colors.textSecondary },
  stepMuted: { fontSize: typography.body, color: colors.textMuted },
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
