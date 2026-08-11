import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { CoralHeader, Card, StatusPill } from '@food-dash/ui';
import { colors, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchMyOrders, statusLabel, isFinished } from '../lib/orders';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export default function OrdersScreen({ navigation }) {
  const { data: orders, error, loading } = useAsync(fetchMyOrders);

  return (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Restaurants', onPress: () => navigation.goBack() }}
        title="Your orders"
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="Couldn't load your orders" detail={error} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
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
            >
              <Card>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.restaurant}</Text>
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
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: typography.body, fontWeight: typography.medium, color: colors.textPrimary },
  meta: { marginTop: 4, fontSize: typography.caption, color: colors.textMuted },
});
