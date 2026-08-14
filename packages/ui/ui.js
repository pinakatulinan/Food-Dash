// The Food-Dash design system, shared by the customer and rider apps.
//
// One language, two densities. The colours, type scale, radii and component
// vocabulary are identical everywhere, so the two apps read as one product.
// What differs is size: a customer taps with a thumb while sitting down, a
// rider taps with a gloved hand at the side of a road. Anything a rider has to
// hit takes `size="large"`.
//
// This replaced Style C — a pastel-coral header block on every screen. That
// system made every screen shout equally, which left nothing for the thing
// that actually mattered on each one. Headers are now type, and colour is
// spent on exactly two jobs: coral means an action, mint means status.
import React from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';

// Tap targets. 44 is Apple's documented minimum; 56 is what a rider gets,
// because the alternative is pulling over to aim.
const TARGET = { default: 44, large: 56 };

/**
 * The top of every screen.
 *
 * `children` holds a status pill or a toggle row — anything that belongs to
 * the screen's identity rather than its content.
 */
export function ScreenHeader({
  title, subtitle, onBack, right, children, size = 'default',
}) {
  const large = size === 'large';
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.back,
              large && styles.backLarge,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={large ? 24 : 20}
              color={colors.textPrimary}
            />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, large && styles.headerTitleLarge]}
            numberOfLines={1}
          >
            {title}
          </Text>
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

export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/**
 * The action.
 *
 * One per screen wherever possible — if everything is prominent, a rider
 * glancing down while the light is green has to read all of it.
 */
export function Button({
  label, onPress, disabled, variant = 'primary', size = 'default', icon,
}) {
  const ghost = variant === 'ghost';
  const large = size === 'large';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { minHeight: TARGET[size] },
        large && styles.buttonLarge,
        ghost && styles.buttonGhost,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={large ? 22 : 18}
          color={ghost ? colors.textPrimary : colors.white}
          style={{ marginRight: spacing.sm }}
        />
      ) : null}
      <Text
        style={[
          ghost ? styles.buttonGhostText : styles.buttonText,
          large && styles.buttonTextLarge,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Input({ label, style, size = 'default', ...props }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          { minHeight: TARGET[size] },
          props.multiline && styles.inputMultiline,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
}

export function LinkButton({ label, onPress, tone = 'coral' }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.link}
    >
      <Text style={tone === 'muted' ? styles.linkMuted : styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** Mint means status, and only status. Never an action. */
export function StatusPill({ label, tone = 'mint' }) {
  const quiet = tone === 'quiet';
  return (
    <View style={[styles.pill, quiet && styles.pillQuiet]}>
      <Text style={[styles.pillText, quiet && styles.pillQuietText]}>{label}</Text>
    </View>
  );
}

/** Errors are coral text, never a filled surface — that's the CTA's job. */
export function ErrorText({ children }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

/**
 * Confirmation dialog.
 *
 * A Modal rather than Alert.alert, which is a no-op on react-native-web — the
 * customer app runs in a browser for testing, and a confirm that silently does
 * nothing there would take its error path with it.
 */
export function ConfirmSheet({
  visible, title, message, confirmLabel, onConfirm, onCancel, busy, error, size,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {message ? <Text style={styles.sheetMessage}>{message}</Text> : null}
          <ErrorText>{error}</ErrorText>
          <Button label={confirmLabel} onPress={onConfirm} disabled={busy} size={size} />
          <LinkButton label="Not now" onPress={onCancel} tone="muted" />
        </View>
      </View>
    </Modal>
  );
}

/** A labelled fact — the bulk of a rider's screen is these. */
export function InfoRow({ label, value, icon }) {
  return (
    <View style={styles.infoRow}>
      {icon ? (
        <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.infoIcon} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

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

/** Quantity control for a basket line. Outlined, so it never competes with
 *  the screen's one coral action. */
export function QtyStepper({ qty, onDecrement, onIncrement, decrementLabel }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDecrement}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.5 }]}
      >
        {decrementLabel === '✕' ? (
          <Ionicons name="trash-outline" size={15} color={colors.textPrimary} />
        ) : (
          <Ionicons name="remove" size={17} color={colors.textPrimary} />
        )}
      </Pressable>
      <Text style={styles.stepperQty}>{qty}</Text>
      <Pressable
        onPress={onIncrement}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.5 }]}
      >
        <Ionicons name="add" size={17} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

/** A row picked from a short list — saved addresses, for now. */
export function SelectRow({ title, detail, selected, onPress, trailing }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.selectRow, pressed && { opacity: 0.6 }]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.coralDeep : colors.border}
      />
      <View style={styles.selectText}>
        <Text style={selected ? styles.selectTitleOn : styles.selectTitle}>{title}</Text>
        {detail ? <Text style={styles.selectDetail}>{detail}</Text> : null}
      </View>
      {trailing}
    </Pressable>
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
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: browse.chipBg,
    alignItems: 'center', justifyContent: 'center',
  },
  backLarge: { width: 44, height: 44, borderRadius: 22 },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  headerTitleLarge: { fontSize: typography.hero - 2 },
  headerSubtitle: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  headerExtra: { marginTop: spacing.sm },

  panel: {
    backgroundColor: browse.sectionBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  button: {
    flexDirection: 'row',
    backgroundColor: colors.coralDeep,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { borderRadius: radius.md, paddingVertical: 16 },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.white, fontSize: typography.body, fontWeight: typography.semibold,
  },
  buttonTextLarge: { fontSize: typography.subhead + 2 },
  buttonGhostText: {
    color: colors.textPrimary, fontSize: typography.body, fontWeight: typography.medium,
  },

  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typography.pill, color: colors.textMuted, marginBottom: spacing.xs,
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
    fontSize: typography.caption, fontWeight: typography.semibold, color: colors.coralDeep,
  },
  linkMuted: { fontSize: typography.caption, color: colors.textMuted },

  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mintPastel,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  pillQuiet: { backgroundColor: browse.chipBg },
  pillText: {
    fontSize: typography.pill, fontWeight: typography.semibold, color: colors.tealTextDark,
  },
  pillQuietText: { color: colors.textMuted },

  error: { fontSize: typography.caption, color: colors.coralDeep, marginBottom: spacing.md },

  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  sheet: {
    width: '100%', maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.subhead, fontWeight: typography.bold, color: colors.textPrimary,
  },
  sheetMessage: {
    marginTop: spacing.xs, marginBottom: spacing.lg,
    fontSize: typography.caption, color: colors.textMuted, lineHeight: 18,
  },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  infoIcon: { marginRight: spacing.sm, marginTop: 2 },
  infoLabel: { fontSize: typography.pill, color: colors.textMuted },
  infoValue: {
    marginTop: 2, fontSize: typography.subhead, color: colors.textPrimary,
  },

  body: { padding: spacing.screenPadding },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperQty: {
    minWidth: 16, textAlign: 'center',
    fontSize: typography.body, fontWeight: typography.medium, color: colors.textPrimary,
  },

  selectRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  selectText: { flex: 1 },
  selectTitle: { fontSize: typography.body, color: colors.textPrimary },
  selectTitleOn: {
    fontSize: typography.body, fontWeight: typography.medium, color: colors.textPrimary,
  },
  selectDetail: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
});
