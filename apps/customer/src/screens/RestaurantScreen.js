import React, { useState, useMemo } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import {
  CoralHeader, HeaderStatusPill, PrimaryButton, ConfirmDialog,
} from '@food-dash/ui';
import { colors, spacing, typography, radius } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { fetchMenu } from '../lib/catalog';
import { useCart } from '../lib/cart';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';

export default function RestaurantScreen({ route, navigation }) {
  const { restaurant } = route.params;
  const {
    entries, subtotalCents, addItem, startNewBasket, isFromAnotherRestaurant,
  } = useCart();

  // Set when adding an item would discard another restaurant's basket. Holds
  // the item so it can be added once the customer confirms.
  const [replacing, setReplacing] = useState(null);

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

  // One basket, one restaurant — multi-restaurant carts are out of the MVP.
  // Rather than silently dropping the old basket, ask.
  const add = (item) => {
    if (isFromAnotherRestaurant(restaurant.id)) {
      setReplacing(item);
      return;
    }
    addItem(item, restaurant);
  };

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
              <Pressable style={styles.addBtn} onPress={() => add(item)}>
                <Text style={styles.addBtnText}>+</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      {/* Only this restaurant's basket gets a bar — showing another
          restaurant's total under this menu would be nonsense. */}
      {entries.length > 0 && !isFromAnotherRestaurant(restaurant.id) && (
        <View style={{ padding: spacing.screenPadding }}>
          <PrimaryButton
            label={`View basket · ${formatMoney(subtotalCents)}`}
            onPress={() => navigation.navigate('Cart')}
          />
        </View>
      )}

      <ConfirmDialog
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
