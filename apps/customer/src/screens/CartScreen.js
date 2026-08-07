import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  CoralHeader, StatusPill, PrimaryButton, Field, ErrorText,
} from '@food-dash/ui';
import { colors, spacing, typography } from '@food-dash/theme';
import { formatMoney } from '@food-dash/money';
import { placeOrder } from '../lib/orders';

export default function CartScreen({ route, navigation }) {
  const { cart, restaurant } = route.params;
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  const entries = Object.values(cart);
  const subtotalCents = entries.reduce((s, e) => s + e.item.priceCents * e.qty, 0);
  const deliveryFeeCents = restaurant.deliveryFeeCents;
  // Shown as an estimate: the database re-prices everything, and that result
  // is what the order actually costs.
  const totalCents = subtotalCents + deliveryFeeCents;

  const submit = async () => {
    setPlacing(true);
    setError(null);
    try {
      const order = await placeOrder({ restaurant, cart, address, notes });
      navigation.replace('Tracking', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
      });
    } catch (e) {
      setError(e.message);
      setPlacing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CoralHeader
        back={{ label: 'Menu', onPress: () => navigation.goBack() }}
        title="Your basket"
        subtitle={`From ${restaurant.name}`}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding }}
        keyboardShouldPersistTaps="handled"
      >
        {entries.map(({ item, qty }) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.left}>
              <StatusPill label={`${qty}x`} />
              <Text style={styles.itemName}>{item.name}</Text>
            </View>
            <Text style={styles.itemName}>{formatMoney(item.priceCents * qty)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <Row label="Subtotal" value={formatMoney(subtotalCents)} muted />
          <Row label="Delivery fee" value={formatMoney(deliveryFeeCents)} muted />
          <Row label="Total" value={formatMoney(totalCents)} bold />
        </View>

        <Field
          label="Deliver to"
          value={address}
          onChangeText={setAddress}
          placeholder="House no., street, barangay"
          autoCapitalize="words"
        />
        <Field
          label="Notes for the rider (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Landmark, gate colour, call on arrival…"
          multiline
        />

        <Text style={styles.payment}>Payment: cash on delivery</Text>

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label={placing ? 'Placing order…' : 'Place order'}
          onPress={submit}
          disabled={placing || !address.trim() || entries.length === 0}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, muted, bold }) {
  const color = bold ? colors.textPrimary : muted ? colors.textMuted : colors.textSecondary;
  const fontWeight = bold ? '500' : '400';
  return (
    <View style={styles.totalRow}>
      <Text style={{ color, fontWeight, fontSize: typography.caption + (bold ? 2 : 0) }}>{label}</Text>
      <Text style={{ color, fontWeight, fontSize: typography.caption + (bold ? 2 : 0) }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { fontSize: typography.body, color: colors.textPrimary },
  totals: { paddingVertical: spacing.md, marginBottom: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  payment: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
