// Marketplace building blocks — Home and Restaurant only.
//
// These deliberately do NOT live in @food-dash/ui. That package is the Style C
// set shared with the rider app: coral header on every screen, one coral CTA,
// mint for status. The browse screens follow a different system — neutral
// chrome, imagery carrying the weight, coral used sparingly as an accent — and
// mixing the two in one package would leave neither legible.
import React from 'react';
import {
  View, Text, Image, Pressable, TextInput, ScrollView, StyleSheet,
} from 'react-native';
import { colors, browse, spacing, radius, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';

// ---------------------------------------------------------------------------
// Imagery
// ---------------------------------------------------------------------------

const FALLBACK_TINTS = ['#F6E7DE', '#E8F1EE', '#F1ECE3', '#EDE8F1', '#E9EFF4'];

/** Stable per-name, so the same dish keeps the same tile every launch. */
function tintFor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length];
}

function initialsFor(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * A photo, or a generated tile when there isn't one.
 *
 * Every restaurant starts with no photo — image_url is nullable and nobody has
 * sent any in yet — so the empty case is the normal case, not an edge case. A
 * tinted initial reads as deliberate; a grey box with a broken-image icon reads
 * as broken.
 */
export function FoodImage({ uri, name, style, rounded }) {
  const shape = [style, rounded ? { borderRadius: radius.lg } : null];

  if (uri) {
    return <Image source={{ uri }} style={shape} resizeMode="cover" />;
  }

  return (
    <View style={[...shape, styles.fallback, { backgroundColor: tintFor(name) }]}>
      <Text style={styles.fallbackText}>{initialsFor(name)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Search + filters
// ---------------------------------------------------------------------------

export function SearchBar({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.search}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
      />
    </View>
  );
}

/** Horizontal filter chips. `null` is the "everything" option. */
export function CategoryRail({ categories, selected, onSelect }) {
  if (!categories.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {[null, ...categories].map((category) => {
        const active = selected === category;
        return (
          <Pressable
            key={category ?? '__all'}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={active ? styles.chipTextActive : styles.chipText}>
              {category ?? 'All'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Cards and rows
// ---------------------------------------------------------------------------

export function RestaurantCard({ restaurant, onPress }) {
  const { name, imageUrl, isOpen, etaMin, etaMax, deliveryFeeCents } = restaurant;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View>
        <FoodImage uri={imageUrl} name={name} style={styles.banner} rounded />
        {/* Closed restaurants stay tappable — you can read the menu, you just
            can't order — so this dims rather than hides. */}
        {!isOpen ? (
          <View style={[styles.banner, styles.closedVeil]}>
            <Text style={styles.closedText}>Closed</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
      <Text style={styles.cardMeta}>
        {etaMin}–{etaMax} min · {formatMoney(deliveryFeeCents)} delivery
      </Text>
    </Pressable>
  );
}

/** A dish: text on the left, square thumbnail and add button on the right. */
export function MenuRow({ item, qty, onAdd }) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuText}>
        <Text style={styles.menuName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.menuDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.menuPrice}>{formatMoney(item.priceCents)}</Text>
      </View>

      <View>
        <FoodImage
          uri={item.imageUrl}
          name={item.name}
          style={styles.thumb}
          rounded
        />
        <Pressable
          onPress={onAdd}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
        {/* How many are already in the basket, so you don't have to open it
            to remember. */}
        {qty > 0 ? (
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyBadgeText}>{qty}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The floating basket bar.
 *
 * Sits above the tab bar rather than replacing it, because losing navigation
 * the moment you add food is how people end up stuck on a menu.
 */
export function CartBar({ count, subtotalCents, onPress }) {
  if (!count) return null;

  return (
    <View style={styles.cartBarWrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cartBar, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.cartCount}>
          <Text style={styles.cartCountText}>{count}</Text>
        </View>
        <Text style={styles.cartBarLabel}>View basket</Text>
        <Text style={styles.cartBarTotal}>{formatMoney(subtotalCents)}</Text>
      </Pressable>
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: {
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.coralTextMid,
    opacity: 0.55,
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSearch,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: { fontSize: 18, color: colors.textMuted },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    height: '100%',
  },

  rail: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    backgroundColor: browse.chipBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: browse.chipActiveBg },
  chipText: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: browse.chipText,
  },
  chipTextActive: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: browse.chipActiveText,
  },

  card: { marginBottom: spacing.lg },
  banner: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: browse.imageFallback,
  },
  closedVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: browse.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    color: colors.white,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
  },
  cardTitle: {
    marginTop: spacing.sm,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  cardMeta: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.textMuted,
  },

  menuRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  menuText: { flex: 1 },
  menuName: {
    fontSize: typography.subhead,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  menuDescription: {
    marginTop: 3,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },
  menuPrice: {
    marginTop: 6,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  thumb: { width: 88, height: 88, backgroundColor: browse.imageFallback },
  addBtn: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 19,
    lineHeight: 22,
    color: colors.coralDeep,
    fontWeight: typography.semibold,
  },
  qtyBadge: {
    position: 'absolute',
    left: -6,
    top: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.coralDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    color: colors.white,
    fontSize: typography.pill,
    fontWeight: typography.bold,
  },

  cartBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.screenPadding,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.coralDeep,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  cartCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: typography.bold,
  },
  cartBarLabel: {
    flex: 1,
    color: colors.white,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  cartBarTotal: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },

  sectionTitle: {
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
});