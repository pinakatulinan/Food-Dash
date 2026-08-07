import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Switch, RefreshControl } from 'react-native';
import { CoralHeader, Card, PrimaryButton, ErrorText } from '@food-dash/ui';
import { colors, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import {
  fetchAvailableOrders, acceptOrder, setOnline, subscribeToOrders,
} from '../lib/rider';

export default function IncomingOrdersScreen({
  navigation, rider, refreshRider, onSignOut,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(null);

  const load = useCallback(async () => {
    if (!rider.is_online) { setOrders([]); return; }
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchAvailableOrders());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [rider.is_online]);

  // Refetch whenever the online flag flips, and on first mount.
  React.useEffect(() => { load(); }, [load]);

  // New orders, and orders another rider just claimed, arrive without a pull.
  React.useEffect(() => {
    if (!rider.is_online) return;
    return subscribeToOrders(load);
  }, [rider.is_online, load]);

  const toggleOnline = async (next) => {
    setError(null);
    try {
      await setOnline(rider.id, next);
      await refreshRider();
    } catch (e) {
      setError(e.message);
    }
  };

  const accept = async (order) => {
    setAccepting(order.id);
    setError(null);
    try {
      const claimed = await acceptOrder(order.id);
      navigation.navigate('ActiveDelivery', { order: claimed });
    } catch (e) {
      // Most often "that order has already been taken" — another rider won
      // the race. Drop it from the list rather than leaving a dead card.
      setError(e.message);
      setOrders((list) => list.filter((o) => o.id !== order.id));
    }
    setAccepting(null);
  };

  return (
    <View style={styles.screen}>
      <CoralHeader
        title="Maayong adlaw!"
        subtitle={rider.is_online ? 'You are online' : 'You are offline'}
        action={{ label: 'Sign out', onPress: onSignOut }}
      >
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {rider.is_online ? 'Accepting orders' : 'Go online to receive orders'}
          </Text>
          <Switch
            value={rider.is_online}
            onValueChange={toggleOnline}
            trackColor={{ true: colors.mintPastel, false: colors.border }}
            thumbColor={rider.is_online ? colors.tealTextDark : colors.textMuted}
          />
        </View>
      </CoralHeader>

      <View style={styles.errorSlot}><ErrorText>{error}</ErrorText></View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.coralDeep} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {rider.is_online
              ? 'No orders waiting. Pull down to refresh.'
              : 'You are offline.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.orderNum}>Order #{item.number}</Text>
              <Text style={styles.payout}>{formatMoney(item.payoutCents)}</Text>
            </View>
            <Text style={styles.meta}>{item.restaurant}</Text>
            <Text style={styles.meta}>{item.pickup} → {item.dropoff}</Text>
            <View style={{ marginTop: spacing.sm }}>
              <PrimaryButton
                label={accepting === item.id ? 'Accepting…' : 'Accept'}
                onPress={() => accept(item)}
                disabled={accepting !== null}
              />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: spacing.sm,
  },
  toggleLabel: { fontSize: typography.caption, color: colors.coralTextMid },
  errorSlot: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md },
  empty: {
    textAlign: 'center', marginTop: spacing.xl,
    fontSize: typography.caption, color: colors.textMuted,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: typography.body, fontWeight: '500', color: colors.textPrimary },
  payout: { fontSize: typography.body, fontWeight: '500', color: colors.coralDeep },
  meta: { marginTop: 3, fontSize: typography.caption, color: colors.textMuted },
});
