// Style C building blocks — every screen in both Expo apps composes these.
// Rules: coral header on every screen, ONE deep-coral CTA per screen,
// mint = status only, white pill for status shown on the coral header.
import React from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { colors, semantic, spacing, radius, typography } from '@food-dash/theme';

// `action` is a quiet secondary control in the top-right — account actions,
// not tasks. Styled as coral text rather than a button so it never reads as
// the screen's CTA.
export function CoralHeader({ title, subtitle, back, action, actions, children }) {
  // `actions` for several, `action` for one — both land in the same row.
  const actionList = actions ?? (action ? [action] : []);
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          onPress={back.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [styles.headerBack, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.headerBackText}>← {back.label ?? 'Back'}</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerActions}>
          {actionList.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.headerAction}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

// White pill with teal text — the only status treatment allowed on coral
export function HeaderStatusPill({ label }) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>{label}</Text>
    </View>
  );
}

// Mint pill — for status anywhere on white surfaces
export function StatusPill({ label }) {
  return (
    <View style={styles.mintPill}>
      <Text style={styles.mintPillText}>{label}</Text>
    </View>
  );
}

// The one deep-coral CTA per screen
export function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.cta,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

// Labelled text input. Neutral on white, like everything below a header.
export function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
}

// Errors have no colour of their own in Style C — deep coral is the only
// alerting tone in the palette, used as text rather than a filled surface so
// it never competes with the screen's single CTA.
export function ErrorText({ children }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

// Quiet secondary action. Deliberately not a button: one coral CTA per screen.
export function TextLink({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Confirmation dialog.
 *
 * Deliberately not React Native's Alert.alert — that is a no-op on
 * react-native-web, so any confirm built on it silently does nothing in a
 * browser, including the error path. Modal works on both.
 */
export function ConfirmDialog({
  visible, title, message, confirmLabel, onConfirm, onCancel, busy, error,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <ErrorText>{error}</ErrorText>
          <PrimaryButton label={confirmLabel} onPress={onConfirm} disabled={busy} />
          <TextLink label="Cancel" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: semantic.headerBg,
    paddingHorizontal: spacing.headerPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerBack: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  headerBackText: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.coralTextMid,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: typography.screenTitle,
    fontWeight: typography.medium,
    color: semantic.headerTitle,
    flexShrink: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerAction: {
    marginLeft: spacing.md,
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.coralTextMid,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: typography.caption,
    color: semantic.headerSubtitle,
  },
  headerPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: semantic.statusPillOnHeaderBg,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  headerPillText: {
    fontSize: typography.pill,
    fontWeight: typography.medium,
    color: semantic.statusPillOnHeaderText,
  },
  mintPill: {
    alignSelf: 'flex-start',
    backgroundColor: semantic.statusBg,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  mintPillText: {
    fontSize: typography.pill,
    fontWeight: typography.medium,
    color: semantic.statusText,
  },
  cta: {
    backgroundColor: semantic.ctaBg,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  ctaText: {
    color: semantic.ctaText,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  error: {
    fontSize: typography.caption,
    color: colors.coralDeep,
    marginBottom: spacing.md,
  },
  link: { paddingVertical: spacing.md, alignItems: 'center' },
  linkText: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.tealTextDark,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  dialogTitle: {
    fontSize: typography.sectionTitle,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  dialogMessage: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semantic.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
