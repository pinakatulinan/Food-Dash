import React, { useState, useMemo, useRef } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { ConfirmSheet } from '../components/chrome';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchMenu } from '../lib/catalog';
import { useCart } from '../lib/cart';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';
import {
  FoodImage, MenuRow, CategoryRail, CartBar,
} from '../components/browse';

export default function RestaurantScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const {
    items, count, subtotalCents, addItem, startNewBasket, isFromAnotherRestaurant,
  } = useCart();

  const [replacing, setReplacing] = useState(null);
  const [jumpTo, setJumpTo] = useState(null);
  const listRef = useRef(null);

  const { data: menu, error, loading } = useAsync(
    () => fetchMenu(restaurant.id),
    [restaurant.id],
  );

  // Categories come out in sort_order, and Object keys preserve insertion
  // order for string keys — so the kitchen's own ordering is what shows.
  const sections = useMemo(() => {
    const byCat = {};
    (menu || []).forEach((m) => { (byCat[m.category] ||= []).push(m); });
    return Object.entries(byCat).map(([title, data]) => ({ title, data }));
  }, [menu]);

  const add = (item) => {
    if (isFromAnotherRestaurant(restaurant.id)) {
      setReplacing(item);
      return;
    }
    addItem(item, restaurant);
  };

  // The rail scrolls the menu rather than filtering it: on a menu this short,
  // hiding four fifths of it to show one section is worse than jumping to it.
  const jump = (category) => {
    setJumpTo(category);
    const index = sections.findIndex((s) => s.title === category);
    if (index < 0 || !listRef.current) return;
    listRef.current.scrollToLocation({
      sectionIndex: index,
      itemIndex: 0,
      viewPosition: 0,
      animated: true,
    });
  };

  const banner = (
    <View>
      <FoodImage uri={restaurant.imageUrl} name={restaurant.name} style={styles.hero} />
      <View style={styles.heroVeil} />
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <View style={styles.heroText}>
        <Text style={styles.heroTitle} numberOfLines={2}>{restaurant.name}</Text>
        <Text style={styles.heroMeta}>
          {restaurant.isOpen ? 'Open now' : 'Closed'} · {restaurant.etaMin}–
          {restaurant.etaMax} min · {formatMoney(restaurant.deliveryFeeCents)} delivery
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {loading ? (
        <>
          {banner}
          <Loading />
        </>
      ) : error ? (
        <>
          {banner}
          <EmptyState title="Couldn't load the menu" detail={error} />
        </>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          // scrollToLocation needs a height hint for sections it hasn't drawn
          // yet; without this, jumping to a section far down lands short.
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            <>
              {banner}
              {restaurant.description ? (
                <Text style={styles.description}>{restaurant.description}</Text>
              ) : null}
              <View style={styles.railWrap}>
                <CategoryRail
                  categories={sections.map((s) => s.title)}
                  selected={jumpTo}
                  onSelect={(c) => (c ? jump(c) : setJumpTo(null))}
                />
              </View>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing on the menu yet"
              detail="This restaurant hasn't added any available items."
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.section}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            // Padding lives here rather than on the list, so section headers
            // and the hero banner can still run edge to edge.
            <View style={styles.rowWrap}>
              <MenuRow item={item} qty={items[item.id]?.qty ?? 0} onAdd={() => add(item)} />
            </View>
          )}
        />
      )}

      {/* Only this restaurant's basket gets a bar — another restaurant's total
          under this menu would be nonsense. */}
      {!isFromAnotherRestaurant(restaurant.id) ? (
        <CartBar
          count={count}
          subtotalCents={subtotalCents}
          onPress={() => navigation.navigate('Cart')}
        />
      ) : null}

      <ConfirmSheet
        visible={replacing != null}
        title="Start a new basket?"
        message={`Your basket has food from another restaurant. Adding ${replacing?.name} will empty it.`}
        confirmLabel="Start new basket"
        onConfirm={() => {
          startNewBasket(replacing, restaurant);
          setReplacing(null);
        }}
        onCancel={() => setReplacing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  list: { paddingBottom: 96 },   // clears the floating basket bar
  rowWrap: { paddingHorizontal: spacing.screenPadding },

  hero: { width: '100%', aspectRatio: 16 / 9, backgroundColor: browse.imageFallback },
  // A scrim, so white text stays readable over whatever photo turns up.
  heroVeil: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: browse.overlay,
  },
  back: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.screenPadding,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 18, lineHeight: 21, color: colors.textPrimary },
  heroText: {
    position: 'absolute',
    left: spacing.screenPadding,
    right: spacing.screenPadding,
    bottom: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.hero,
    fontWeight: typography.bold,
    color: colors.white,
  },
  heroMeta: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.white,
    opacity: 0.9,
  },

  description: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  railWrap: {
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    backgroundColor: browse.pageBg,
  },
});