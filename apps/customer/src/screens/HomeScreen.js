import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { fetchRestaurants } from '../lib/catalog';
import { fetchAddresses } from '../lib/addresses';
import { useCart } from '../lib/cart';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';
import {
  SearchBar, CategoryRail, RestaurantCard, SectionTitle, CartBar,
} from '../components/browse';

export default function HomeScreen({ navigation }) {
  const { data: restaurants, error, loading } = useAsync(fetchRestaurants);
  const addressState = useAsync(fetchAddresses);
  const { count, subtotalCents } = useCart();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);

  // Every category any restaurant actually serves. Derived rather than stored:
  // there is no cuisine field, and what a kitchen cooks is a truer answer than
  // a tag someone set once and forgot.
  const categories = useMemo(() => {
    const all = new Set();
    (restaurants ?? []).forEach((r) => r.categories.forEach((c) => all.add(c)));
    return [...all].sort();
  }, [restaurants]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (restaurants ?? []).filter((r) => {
      if (category && !r.categories.includes(category)) return false;
      if (!q) return true;
      // Match the menu too — someone searching "sisig" wants the place that
      // sells it, not only a restaurant with sisig in its name.
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        r.categories.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [restaurants, query, category]);

  // fetchAddresses sorts default first, so the first row is the one in use.
  const deliverTo = addressState.data?.[0]?.address;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Pressable
          onPress={() => navigation.navigate('Account')}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.deliverLabel}>Deliver to</Text>
          <Text style={styles.deliverValue} numberOfLines={1}>
            {deliverTo ?? 'Set an address at checkout'}
          </Text>
        </Pressable>

        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search restaurants or dishes"
          />
        </View>

        <CategoryRail
          categories={categories}
          selected={category}
          onSelect={setCategory}
        />
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="Couldn't load restaurants"
          icon="cloud-offline-outline" detail={error} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <SectionTitle style={styles.sectionTitle}>
              {category ?? 'All restaurants'}
            </SectionTitle>
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing matches"
              icon="search-outline"
              detail={
                query
                  ? `No restaurant or dish for "${query.trim()}".`
                  : 'No restaurants in this category yet.'
              }
            />
          }
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => navigation.navigate('Restaurant', { restaurant: item })}
            />
          )}
        />
      )}

      <CartBar
        count={count}
        subtotalCents={subtotalCents}
        onPress={() => navigation.navigate('Cart')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  top: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  deliverLabel: { fontSize: typography.pill, color: colors.textMuted },
  deliverValue: {
    marginTop: 1,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  searchWrap: { marginTop: spacing.md },
  list: {
    padding: spacing.screenPadding,
    paddingBottom: 96,   // clears the floating basket bar
  },
  sectionTitle: { marginBottom: spacing.md },
});