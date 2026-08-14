import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, browse, spacing, typography } from '@food-dash/theme';

// Loading and empty states. Neutral by design — these are moments where
// nothing is happening, so they should be quiet rather than decorative.

export function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.coralDeep} />
    </View>
  );
}

/**
 * An empty screen that explains itself.
 *
 * The icon isn't decoration: an empty list with no explanation reads as a
 * failure, and a customer who thinks the app is broken closes it. A shape and
 * a sentence say "nothing here yet" far faster than a sentence alone.
 */
export function EmptyState({ title, detail, icon = 'help-circle-outline' }) {
  return (
    <View style={styles.centered}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
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
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: browse.sectionBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  detail: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
