import React, { useState, useMemo } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { CoralHeader, HeaderStatusPill, PrimaryButton } from '@food-dash/ui';
import { colors, spacing, typography, radius } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchMenu } from '../lib/catalog';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';

export default function RestaurantScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const [cart, setCart] = useState({}); // { itemId: { item, qty } }

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

  const addItem = (item) =>
    setCart((c) => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty || 0) + 1 } }));

  const cartTotalCents = Object.values(cart).reduce((s, e) => s + e.item.priceCents * e.qty, 0);

  return (
    <View style={styles.screen}>
      <CoralHeader
        back={{ label: 'Restaurants', onPress: () => navigation.goBack() }}
        title={restaurant.name}
        subtitle={`${restaurant.etaMin}-${restaurant.etaMax} min · ${formatMoney(restaurant.deliveryFeeCents)} delivery`}
      >
        <HeaderStatusPill label={restaurant.isOpen ? 'Open now' : 'Closed'} />
      </CoralHeader>
      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="Couldn't load the menu" detail={error} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.screenPadding }}
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
            <View style={styles.itemRow}>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                ) : null}
                <Text style={styles.itemPrice}>{formatMoney(item.priceCents)}</Text>
              </View>
              <Pressable style={styles.addBtn} onPress={() => addItem(item)}>
                <Text style={styles.addBtnText}>+</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      {cartTotalCents > 0 && (
        <View style={{ padding: spacing.screenPadding }}>
          <PrimaryButton
            label={`View basket · ${formatMoney(cartTotalCents)}`}
            onPress={() => navigation.navigate('Cart', { cart, restaurant })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  section: {
    fontSize: typography.sectionTitle, fontWeight: typography.medium,
    color: colors.textPrimary, backgroundColor: colors.white,
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  itemText: { flex: 1, paddingRight: spacing.md },
  itemName: { fontSize: typography.body, color: colors.textPrimary },
  itemDescription: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  itemPrice: { marginTop: 2, fontSize: typography.caption, color: colors.textMuted },
  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.coralDeep, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: colors.white, fontSize: 18, lineHeight: 20, fontWeight: '500' },
});
