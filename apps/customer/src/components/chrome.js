// App-wide shell for the customer app.
//
// Sibling to browse.js, which stays marketplace-specific (food imagery, menu
// rows, the basket bar). This file holds the pieces every screen needs: the
// header, panels, buttons, inputs, the confirm dialog.
//
// These deliberately do NOT live in @food-dash/ui. That package is the Style C
// set — pastel-coral header on every screen, one coral CTA, mint for status —
// and the rider app depends on all of it. Restyling it there would silently
// redesign an app that currently can't be run on a device to check.
//
// What we still take from @food-dash/ui: StatusPill and ErrorText, because
// mint remains the status colour and neither carries Style C's chrome.
import React from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';
import { ErrorText } from '@food-dash/ui';

/**
 * The top of every screen.
 *
 * Replaces CoralHeader. Where Style C announced a screen with a block of
 * colour, this leans on type — which is what lets the content below it be the
 * loudest thing on the page.
 *
 * `children` is the same slot CoralHeader offered, used for a status pill.
 */
export function ScreenHeader({ title, subtitle, onBack, right, children }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            // Same circular chevron as the one over the restaurant hero, so
            // "go back" looks identical wherever it appears.
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children ? <View style={styles.headerExtra}>{children}</View> : null}
    </View>
  );
}

/** Replaces Card. A tinted surface rather than an outlined box. */
export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/**
 * The primary action.
 *
 * Weight and radius match CartBar in browse.js on purpose: those are the two
 * big coral controls in the app and they sit one screen apart, so any
 * difference between them reads as a mistake.
 */
export function Button({ label, onPress, disabled, variant = 'primary' }) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        ghost && styles.buttonGhost,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={ghost ? styles.buttonGhostText : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Replaces Field. Filled rather than outlined, matching SearchBar. */
export function Input({ label, style, ...props }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, props.multiline && styles.inputMultiline, style]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
}

/** Replaces TextLink — a quiet secondary action. */
export function LinkButton({ label, onPress, tone = 'coral' }) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={tone === 'muted' ? styles.linkMuted : styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Replaces ConfirmDialog.
 *
 * Still a Modal, never Alert.alert — Alert is a no-op on react-native-web, so
 * anything built on it silently does nothing in a browser, including its own
 * error path. The customer app runs on web for testing, so that matters here.
 */
export function ConfirmSheet({
  visible, title, message, confirmLabel, onConfirm, onCancel, busy, error,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {message ? <Text style={styles.sheetMessage}>{message}</Text> : null}
          <ErrorText>{error}</ErrorText>
          <Button label={confirmLabel} onPress={onConfirm} disabled={busy} />
          <LinkButton label="Not now" onPress={onCancel} tone="muted" />
        </View>
      </View>
    </Modal>
  );
}

/** Scrollable body with the app's standard padding. */
export function Body({ children, contentStyle, ...props }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.body, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: browse.pageBg,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: browse.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontSize: 18, lineHeight: 21, color: colors.textPrimary },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  headerExtra: { marginTop: spacing.sm, flexDirection: 'row' },

  panel: {
    backgroundColor: browse.sectionBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  button: {
    backgroundColor: colors.coralDeep,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  buttonGhostText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: typography.medium,
  },

  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.pill,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceSearch,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },

  link: { paddingVertical: spacing.md, alignItems: 'center' },
  linkText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.coralDeep,
  },
  linkMuted: { fontSize: typography.caption, color: colors.textMuted },

  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.subhead,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  sheetMessage: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },

  body: { padding: spacing.screenPadding },
});
