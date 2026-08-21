import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';

// react-native-maps has no web build, and Metro resolves imports statically —
// so this file exists to keep the module off web entirely rather than crash
// the checkout screen during browser testing.
//
// Ordering still works here; the order just carries no pin, exactly as every
// order did before 015. The rider falls back to the typed address.
export default function LocationPicker() {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Pin your location on a phone</Text>
      <Text style={styles.detail}>
        The map picker needs the app on a phone. You can still order from here —
        your rider will use the address you typed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: browse.sectionBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  detail: {
    marginTop: 4, fontSize: typography.caption,
    color: colors.textMuted, lineHeight: 18,
  },
});
