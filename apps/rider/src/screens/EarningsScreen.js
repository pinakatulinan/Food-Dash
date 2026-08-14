import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenHeader, Panel, ErrorText } from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchEarnings } from '../lib/rider';
import { useAsync } from '../lib/useAsync';

export default function EarningsScreen({ route, navigation }) {
  const { riderId } = route.params;
  const { data, error, loading } = useAsync(() => fetchEarnings(riderId), [riderId]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        size="large"
        onBack={() => navigation.goBack()}
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
            <Panel>
              <Text style={styles.label}>Today</Text>
              <Text style={styles.big}>{formatMoney(data.todayCents)}</Text>
              <Text style={styles.meta}>
                {data.trips} {data.trips === 1 ? 'delivery' : 'deliveries'}
              </Text>
            </Panel>
            <Panel>
              <Text style={styles.label}>Last 7 days</Text>
              <Text style={styles.big}>{formatMoney(data.weekCents)}</Text>
              <Text style={styles.meta}>
                Food-Dash keeps 15% of the delivery fee — the rest is yours
              </Text>
            </Panel>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  label: { fontSize: typography.pill, color: colors.textMuted },
  big: {
    fontSize: typography.hero,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  meta: { marginTop: 4, fontSize: typography.caption, color: colors.textMuted },
});
