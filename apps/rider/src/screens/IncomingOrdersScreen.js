import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Switch, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenHeader, Panel, Button, StatusPill, ErrorText,
} from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import {
  fetchAvailableOrders, acceptOrder, setOnline, subscribeToOrders,
  fetchActiveDelivery,
} from '../lib/rider';

export default function IncomingOrdersScreen({
  navigation, rider, refreshRider, onSignOut,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [active, setActive] = useState(null);

  // A delivery can still be running while this screen is showing — the rider
  // pressed back, or the app reopened here. Without a way back to it they'd
  // have to accept another order to get anywhere, which is exactly wrong when
  // they're already carrying food.
  const checkActive = useCallback(async () => {
    try {
      setActive(await fetchActiveDelivery(rider.id));
    } catch {
      // Never block the orders list on this.
    }
  }, [rider.id]);

  React.useEffect(() => {
    // Re-checked when the screen regains focus, so finishing a delivery clears
    // the card on the way back rather than leaving a stale one.
    const unsubscribe = navigation.addListener('focus', checkActive);
    checkActive();
    return unsubscribe;
  }, [navigation, checkActive]);

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
      setActive(claimed);
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
      <ScreenHeader
        size="large"
        title="Maayong adlaw!"
        right={<Ionicons name="log-out-outline" size={24} color={colors.textMuted}
                 onPress={onSignOut} suppressHighlighting />}
      >
        {/* Online/offline is the single most consequential thing on this
            screen — it decides whether a rider earns anything — so it gets a
            whole row and states plainly what it means. */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleState}>
              {rider.is_online ? 'You are online' : 'You are offline'}
            </Text>
            <Text style={styles.toggleLabel}>
              {rider.is_online ? 'Accepting orders' : 'Go online to receive orders'}
            </Text>
          </View>
          <Switch
            value={rider.is_online}
            onValueChange={toggleOnline}
            trackColor={{ true: colors.mintPastel, false: colors.border }}
            thumbColor={rider.is_online ? colors.tealTextDark : colors.textMuted}
          />
        </View>
      </ScreenHeader>

      <View style={styles.errorSlot}><ErrorText>{error}</ErrorText></View>

      {active ? (
        <View style={styles.resumeWrap}>
          <Button
            label={`Back to delivery · Order #${active.number}`}
            icon="bicycle"
            size="large"
            onPress={() => navigation.navigate('ActiveDelivery', { order: active })}
          />
        </View>
      ) : null}

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
          <Panel>
            {/* Payout first and largest: it is the only thing a rider is
                deciding on, and they are deciding fast. */}
            <View style={styles.rowBetween}>
              <Text style={styles.payout}>{formatMoney(item.payoutCents)}</Text>
              <StatusPill label={`#${item.number}`} tone="quiet" />
            </View>
            <Text style={styles.restaurant}>{item.restaurant}</Text>

            <View style={styles.legRow}>
              <Ionicons name="storefront-outline" size={16} color={colors.textMuted} />
              <Text style={styles.leg} numberOfLines={1}>{item.pickup}</Text>
            </View>
            <View style={styles.legRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.leg} numberOfLines={1}>{item.dropoff}</Text>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Button
                label={accepting === item.id ? 'Accepting…' : 'Accept order'}
                size="large"
                onPress={() => accept(item)}
                disabled={accepting !== null}
              />
            </View>
          </Panel>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleState: {
    fontSize: typography.subhead, fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  toggleLabel: { marginTop: 1, fontSize: typography.caption, color: colors.textMuted },
  errorSlot: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md },
  resumeWrap: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md },
  empty: {
    textAlign: 'center', marginTop: spacing.xl,
    fontSize: typography.caption, color: colors.textMuted,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payout: {
    fontSize: typography.hero, fontWeight: typography.bold, color: colors.coralDeep,
  },
  restaurant: {
    marginTop: 2, marginBottom: spacing.sm,
    fontSize: typography.subhead, fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  leg: { flex: 1, fontSize: typography.caption, color: colors.textMuted },
});
