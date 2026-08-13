import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { StatusPill } from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchMyOrders, statusLabel, isFinished } from '../lib/orders';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';
import { ScreenHeader, Panel } from '../components/chrome';
import { FoodImage } from '../components/browse';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export default function OrdersScreen({ navigation }) {
  const { data: orders, error, loading } = useAsync(fetchMyOrders);

  return (
    <View style={styles.screen}>
      {/* No back button — this is a tab, not a pushed screen. */}
      <ScreenHeader title="Your orders" />
      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="Couldn't load your orders" detail={error} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No orders yet"
              detail="Anything you order will show up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('Tracking', {
                  orderId: item.id,
                  orderNumber: item.number,
                })
              }
              style={({ pressed }) => pressed && { opacity: 0.85 }}
            >
              <Panel style={styles.card}>
                {/* Same image language as the rest of the app — a photo where
                    there is one, a tinted tile where there isn't. */}
                <FoodImage
                  uri={item.restaurantImageUrl}
                  name={item.restaurant}
                  style={styles.thumb}
                  rounded
                />
                <View style={styles.text}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.restaurant}</Text>
                    {/* Mint means status, never action — so live orders get the
                        pill and finished ones stay quiet. */}
                    {!isFinished(item) && <StatusPill label={statusLabel(item)} />}
                  </View>
                  <Text style={styles.meta}>
                    Order #{item.number} · {formatMoney(item.totalCents)}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDate(item.placedAt)}
                    {isFinished(item) ? ` · ${statusLabel(item)}` : ''}
                  </Text>
                </View>
              </Panel>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  list: { padding: spacing.screenPadding, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  thumb: { width: 56, height: 56, backgroundColor: browse.imageFallback },
  text: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  meta: { marginTop: 3, fontSize: typography.caption, color: colors.textMuted },
});
