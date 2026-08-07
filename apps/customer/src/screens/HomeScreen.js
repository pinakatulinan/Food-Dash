import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { CoralHeader, StatusPill, Card, ConfirmDialog } from '@food-dash/ui';
import { colors, spacing, typography, radius } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { supabase } from '../lib/supabase';
import { fetchRestaurants } from '../lib/catalog';
import { useAsync } from '../lib/useAsync';
import { Loading, EmptyState } from '../components/states';

export default function HomeScreen({ navigation }) {
  const { data: restaurants, error, loading } = useAsync(fetchRestaurants);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSignOutError(error.message);
      setSigningOut(false);
      return;
    }
    // On success onAuthStateChange clears the session and App swaps in the
    // auth screen — nothing to navigate here.
  };

  return (
    <View style={styles.screen}>
      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        message="You can sign back in any time."
        confirmLabel={signingOut ? 'Signing out…' : 'Sign out'}
        onConfirm={signOut}
        onCancel={() => {
          setConfirming(false);
          setSignOutError(null);
        }}
        busy={signingOut}
        error={signOutError}
      />
      <CoralHeader
        title="Kaon ta!"
        subtitle="Deliver to Talisay City"
        action={{ label: 'Sign out', onPress: () => setConfirming(true) }}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="Couldn't load restaurants" detail={error} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          ListEmptyComponent={
            <EmptyState
              title="No restaurants yet"
              detail="Run supabase/seed.sql to load the sample Cebu restaurants."
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('Restaurant', { restaurant: item })}>
              <Card>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isOpen && <StatusPill label="Open" />}
                </View>
                <Text style={styles.meta}>
                  {item.etaMin}-{item.etaMax} min · {formatMoney(item.deliveryFeeCents)} delivery
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: typography.body, fontWeight: typography.medium, color: colors.textPrimary },
  meta: { marginTop: 4, fontSize: typography.caption, color: colors.textMuted },
});
