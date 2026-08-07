import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CoralHeader, HeaderStatusPill, Card } from '@food-dash/ui';
import { colors, spacing, typography, radius } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import {
  fetchOrder, subscribeToOrder, ORDER_STEPS as STEPS, stepFor, statusLabel,
} from '../lib/orders';
import { Loading, EmptyState } from '../components/states';

function subtitleFor(order) {
  if (order.deliveryStatus === 'assigned') return 'A rider is on the way to the restaurant';
  if (order.status === 'ready_for_pickup') return 'Waiting for a rider to collect it';
  return null;
}

export default function TrackingScreen({ route, navigation }) {
  const { orderId, orderNumber } = route.params;
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

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

  return header(
    <View style={styles.body}>
      <Card>
        <Text style={styles.restaurant}>{order.restaurant}</Text>
        <Text style={styles.total}>{formatMoney(order.totalCents)} · cash on delivery</Text>
      </Card>
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
