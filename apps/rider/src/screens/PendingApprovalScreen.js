import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CoralHeader, Card, HeaderStatusPill } from '@food-dash/ui';
import { colors, spacing, typography } from '@food-dash/theme';

// Shown when a rider account exists but isn't approved. The database enforces
// this too — the check constraint on riders makes going online impossible
// while status is 'pending', so this screen explains rather than protects.
export default function PendingApprovalScreen({ status, onSignOut }) {
  const suspended = status === 'suspended';

  return (
    <View style={styles.screen}>
      <CoralHeader
        title={suspended ? 'Account suspended' : 'Application received'}
        subtitle="Food-Dash Rider"
        action={{ label: 'Sign out', onPress: onSignOut }}
      >
        <HeaderStatusPill label={suspended ? 'Suspended' : 'Pending review'} />
      </CoralHeader>
      <View style={styles.body}>
        <Card>
          <Text style={styles.title}>
            {suspended ? 'You can’t take orders right now' : 'We’re checking your details'}
          </Text>
          <Text style={styles.detail}>
            {suspended
              ? 'Please get in touch with the Food-Dash team to sort this out.'
              : 'Bring your driver’s licence, OR/CR and a valid ID to the Food-Dash team. Once you’re approved this screen becomes your order list.'}
          </Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { padding: spacing.screenPadding },
  title: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  detail: {
    marginTop: spacing.xs,
    fontSize: typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
