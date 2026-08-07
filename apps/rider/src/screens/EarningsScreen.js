import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CoralHeader, Card, ErrorText } from '@kaon/ui';
import { colors, spacing, typography } from '@kaon/theme';
import { formatMoney } from '@kaon/money';
import { fetchEarnings } from '../lib/rider';
import { useAsync } from '../lib/useAsync';

export default function EarningsScreen({ route, navigation }) {
  const { riderId } = route.params;
  const { data, error, loading } = useAsync(() => fetchEarnings(riderId), [riderId]);

  return (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Orders', onPress: () => navigation.goBack() }}
        title="Earnings"
        subtitle="Delivered orders only"
      />
      <View style={{ padding: spacing.screenPadding, gap: spacing.md }}>
        {loading ? (
          <ActivityIndicator color={colors.coralDeep} />
        ) : error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <>
            <Card>
              <Text style={styles.label}>Today</Text>
              <Text style={styles.big}>{formatMoney(data.todayCents)}</Text>
              <Text style={styles.meta}>
                {data.trips} {data.trips === 1 ? 'delivery' : 'deliveries'}
              </Text>
            </Card>
            <Card>
              <Text style={styles.label}>Last 7 days</Text>
              <Text style={styles.big}>{formatMoney(data.weekCents)}</Text>
              <Text style={styles.meta}>
                Kaon keeps 15% of the delivery fee — the rest is yours
              </Text>
            </Card>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  label: { fontSize: typography.pill, color: colors.textMuted },
  big: { fontSize: 28, fontWeight: '500', color: colors.textPrimary, marginTop: 2 },
  meta: { marginTop: 4, fontSize: typography.caption, color: colors.textMuted },
});
