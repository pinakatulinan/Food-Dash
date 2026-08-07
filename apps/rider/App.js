import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography } from '@kaon/theme';
import { supabase } from './src/lib/supabase';
import { useSession } from './src/lib/useSession';
import { fetchRiderRecord } from './src/lib/rider';
import AuthScreen from './src/screens/AuthScreen';
import PendingApprovalScreen from './src/screens/PendingApprovalScreen';
import IncomingOrdersScreen from './src/screens/IncomingOrdersScreen';
import ActiveDeliveryScreen from './src/screens/ActiveDeliveryScreen';
import EarningsScreen from './src/screens/EarningsScreen';

const Stack = createNativeStackNavigator();
const signOut = () => supabase.auth.signOut();

export default function App() {
  const { session, loading } = useSession();
  const [rider, setRider] = useState(null);
  const [riderLoading, setRiderLoading] = useState(true);

  // Keyed on the user id, not the session object. Supabase hands out a fresh
  // session on every token refresh, and depending on the object meant an idle
  // rider got bounced back to the splash — unmounting the navigator and
  // losing the delivery they were part-way through.
  const userId = session?.user?.id ?? null;

  const refreshRider = useCallback(async () => {
    if (!userId) { setRider(null); setRiderLoading(false); return; }
    try {
      setRider(await fetchRiderRecord());
    } catch {
      setRider(null);
    }
    setRiderLoading(false);
  }, [userId]);

  useEffect(() => { setRiderLoading(true); refreshRider(); }, [refreshRider]);

  if (loading || (session && riderLoading)) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.coralDeep} />
      </View>
    );
  }

  if (!session) {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <AuthScreen />
      </NavigationContainer>
    );
  }

  // Signed in with an account that has no riders row — almost always a
  // customer account signed into the wrong app.
  if (!rider) {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <View style={styles.splash}>
          <Text style={styles.wrongApp}>This is a customer account.</Text>
          <Text style={styles.wrongAppDetail}>
            Rider accounts are separate. Sign out and apply as a rider.
          </Text>
          <Text style={styles.link} onPress={signOut}>Sign out</Text>
        </View>
      </NavigationContainer>
    );
  }

  if (rider.status !== 'approved') {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <PendingApprovalScreen status={rider.status} onSignOut={signOut} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="IncomingOrders">
          {(props) => (
            <IncomingOrdersScreen
              {...props}
              rider={rider}
              refreshRider={refreshRider}
              onSignOut={signOut}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
        <Stack.Screen
          name="Earnings"
          component={EarningsScreen}
          initialParams={{ riderId: rider.id }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, padding: spacing.xl, gap: spacing.xs,
  },
  wrongApp: {
    fontSize: typography.body, fontWeight: typography.medium,
    color: colors.textPrimary, textAlign: 'center',
  },
  wrongAppDetail: {
    fontSize: typography.caption, color: colors.textMuted, textAlign: 'center',
  },
  link: {
    marginTop: spacing.md, fontSize: typography.caption,
    fontWeight: typography.medium, color: colors.tealTextDark,
  },
});
