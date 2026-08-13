import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusPill, ErrorText } from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';
import { fetchAddresses, setDefaultAddress, deleteAddress } from '../lib/addresses';
import { useAsync } from '../lib/useAsync';
import { Loading } from '../components/states';
import { ScreenHeader, ConfirmSheet, LinkButton } from '../components/chrome';

export default function AccountScreen() {
  const { session } = useSession();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const state = useAsync(fetchAddresses);
  const rows = addresses ?? state.data;

  // Addresses are managed here now that there's somewhere to put them. Saving
  // still happens at checkout, where the address is actually needed — this is
  // for the tidying up afterwards.
  const act = async (id, fn) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      setAddresses(await fetchAddresses());
    } catch (e) {
      setError(e.message);
    }
    setBusyId(null);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Account" subtitle={session?.user?.email} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Saved addresses</Text>
        <ErrorText>{error ?? state.error}</ErrorText>

        {state.loading && !rows ? (
          <Loading />
        ) : !rows?.length ? (
          <Text style={styles.empty}>
            None yet. Tick “Save this address for next time” at checkout and it
            will show up here.
          </Text>
        ) : (
          rows.map((a) => (
            <View key={a.id} style={styles.addressRow}>
              <View style={styles.addressText}>
                <View style={styles.addressTop}>
                  <Text style={styles.addressLabel}>{a.label || 'Address'}</Text>
                  {a.isDefault ? <StatusPill label="Default" /> : null}
                </View>
                <Text style={styles.addressValue}>{a.address}</Text>
              </View>
              <View style={styles.addressActions}>
                {!a.isDefault ? (
                  <Pressable
                    disabled={busyId === a.id}
                    onPress={() => act(a.id, () => setDefaultAddress(a.id))}
                  >
                    <Text style={styles.action}>Set default</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={busyId === a.id}
                  onPress={() => act(a.id, () => deleteAddress(a.id))}
                >
                  <Text style={styles.actionQuiet}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={styles.signOut}>
          <LinkButton
            label="Sign out"
            tone="muted"
            onPress={() => setConfirmingSignOut(true)}
          />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmingSignOut}
        title="Sign out?"
        message="You'll need to sign in again to order."
        confirmLabel="Sign out"
        onConfirm={() => supabase.auth.signOut()}
        onCancel={() => setConfirmingSignOut(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  body: { padding: spacing.screenPadding },
  heading: {
    marginBottom: spacing.sm,
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  empty: { fontSize: typography.caption, color: colors.textMuted, lineHeight: 18 },
  addressRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  addressText: { gap: 3 },
  addressTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addressLabel: {
    fontSize: typography.subhead,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  addressValue: { fontSize: typography.caption, color: colors.textMuted },
  addressActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  action: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.coralDeep,
  },
  actionQuiet: { fontSize: typography.caption, color: colors.textMuted },
  signOut: { marginTop: spacing.xl },
});