import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@food-dash/theme';

// Neutral by design: content below a coral header stays white and muted, so
// loading and empty states never compete with the header or the screen's CTA.

export function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.coralDeep} />
    </View>
  );
}

export function EmptyState({ title, detail }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  detail: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
