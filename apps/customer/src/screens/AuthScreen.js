import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, browse, spacing, typography } from '@food-dash/theme';
import { ErrorText } from '@food-dash/ui';
import { Input, Button, LinkButton } from '../components/chrome';
import { supabase } from '../lib/supabase';

// Email + password with confirmations turned off, so signup logs you straight
// in. Phone OTP replaces this later; the screen keeps its shape either way.
export default function AuthScreen() {
  const [signingUp, setSigningUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (signingUp && !fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: authError } = signingUp
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          // handle_new_user() reads these to build the profile row. Without
          // full_name the profile is created with a blank name; role is
          // whitelisted server-side, so sending it is a hint, not a grant.
          options: { data: { full_name: fullName.trim(), role: 'customer' } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }

    // Signup succeeds without issuing a session when email confirmation is
    // still enabled. Without this branch the button sits on "Creating
    // account…" forever, looking like a hang rather than a pending email.
    if (!data.session) {
      setError('Account created, but it needs confirming before you can sign in. Check your email, or turn off email confirmation in Supabase for development.');
      setBusy(false);
      return;
    }

    // Otherwise onAuthStateChange swaps this screen out from under us.
  };

  const swapMode = () => {
    setSigningUp(!signingUp);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* The front door. No coral header block here — this is the one screen
            that should feel like a brand rather than a tool, and it's the only
            place in the app where colour fills a whole region. */}
        <LinearGradient
          colors={[colors.coralDeep, '#E8804F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.wordmark}>Food-Dash</Text>
          <Text style={styles.tagline}>
            Cebu's neighbourhood kitchens, delivered.
          </Text>
        </LinearGradient>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {signingUp ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.formSubtitle}>
            {signingUp
              ? 'So we know who to deliver to.'
              : 'Sign in to order from your neighbourhood.'}
          </Text>

          <View style={styles.fields}>
            {signingUp && (
              <Input
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Juan dela Cruz"
                autoCapitalize="words"
                textContentType="name"
              />
            )}
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              textContentType={signingUp ? 'newPassword' : 'password'}
            />
          </View>

          <ErrorText>{error}</ErrorText>

          <Button
            label={
              busy
                ? signingUp ? 'Creating account…' : 'Signing in…'
                : signingUp ? 'Create account' : 'Sign in'
            }
            onPress={submit}
            disabled={busy || !email.trim() || !password}
          />
          <LinkButton
            label={
              signingUp
                ? 'Already have an account? Sign in'
                : 'New here? Create an account'
            }
            onPress={swapMode}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: 72,
    paddingBottom: spacing.xl * 2,
  },
  wordmark: {
    fontSize: typography.hero,
    fontWeight: typography.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: typography.subhead,
    color: colors.white,
    opacity: 0.9,
  },
  form: {
    // Pulled up over the gradient so the form reads as sitting on top of the
    // brand panel rather than starting after it.
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    backgroundColor: browse.pageBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  formTitle: {
    fontSize: typography.title,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  formSubtitle: {
    marginTop: 2,
    marginBottom: spacing.xl,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  fields: { marginBottom: spacing.sm },
});
