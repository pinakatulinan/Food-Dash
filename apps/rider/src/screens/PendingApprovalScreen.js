import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenHeader, Panel, StatusPill, LinkButton } from '@food-dash/ui';
import { colors, browse, spacing, typography } from '@food-dash/theme';

// Shown when a rider account exists but isn't approved. The database enforces
// this too — the check constraint on riders makes going online impossible
// while status is 'pending', so this screen explains rather than protects.
export default function PendingApprovalScreen({ status, onSignOut }) {
  const suspended = status === 'suspended';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        size="large"
        title={suspended ? 'Account suspended' : 'Application received'}
        subtitle="Food-Dash Rider"
        right={<LinkButton label="Sign out" tone="muted" onPress={onSignOut} />}
      >
        <StatusPill
          label={suspended ? 'Suspended' : 'Pending review'}
          tone={suspended ? 'quiet' : 'mint'}
        />
      </ScreenHeader>
      <View style={styles.body}>
        <Panel>
          <Text style={styles.title}>
            {suspended ? 'You can’t take orders right now' : 'We’re checking your details'}
          </Text>
          <Text style={styles.detail}>
            {suspended
              ? 'Please get in touch with the Food-Dash team to sort this out.'
              : 'Bring your driver’s licence, OR/CR and a valid ID to the Food-Dash team. Once you’re approved this screen becomes your order list.'}
          </Text>
        </Panel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
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
