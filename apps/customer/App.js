import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, typography } from '@food-dash/theme';
import { useSession } from './src/lib/useSession';
import { CartProvider } from './src/lib/cart';
import { useNavigationState } from './src/lib/navState';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import AccountScreen from './src/screens/AccountScreen';
import RestaurantScreen from './src/screens/RestaurantScreen';
import CartScreen from './src/screens/CartScreen';
import TrackingScreen from './src/screens/TrackingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// No icon font is installed, so the tab bar uses glyphs. Swapping in a real
// icon set later means changing this map and nothing else.
const TAB_GLYPH = {
  Home: '⌂',
  Orders: '☰',
  Account: '☺',
};

/**
 * The three places you can always get back to.
 *
 * Order history used to be reachable only through a text link in the Home
 * header, which is a lot of hiding for the second thing anyone opens the app
 * to do. A tab bar also means adding food never strands you on a menu.
 */
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.coralDeep,
        tabBarInactiveTintColor: colors.iconInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18 }}>{TAB_GLYPH[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { session, loading } = useSession();
  const nav = useNavigationState();

  // Held until the stored session has been read back, so a signed-in user
  // never sees the login screen flash past on a cold start. The saved screen
  // position is waited on for the same reason — restoring it after the first
  // render would show Home for a frame and then jump.
  if (loading || !nav.ready) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.coralDeep} />
      </View>
    );
  }

  // The basket lives above the navigator so it survives moving between the
  // menu and the cart, and is restored from storage on a cold start.
  return (
    <CartProvider>
      <NavigationContainer
        initialState={nav.initialState}
        onStateChange={nav.onStateChange}
      >
        <StatusBar style="dark" />
        {session ? (
          // Restaurant, Cart and Tracking sit OUTSIDE the tabs on purpose:
          // each is a task you're meant to finish, and a tab bar offering an
          // exit halfway through checkout loses orders.
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Tracking" component={TrackingScreen} />
          </Stack.Navigator>
        ) : (
          <AuthScreen />
        )}
      </NavigationContainer>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    height: 58,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabLabel: { fontSize: typography.pill, fontWeight: typography.medium },
});