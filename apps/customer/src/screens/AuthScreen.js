import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CoralHeader, PrimaryButton, Field, ErrorText, TextLink } from '@food-dash/ui';
import { colors, spacing } from '@food-dash/theme';
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
      <CoralHeader
        title={signingUp ? 'Create your account' : 'Kaon ta!'}
        subtitle={
          signingUp
            ? 'So we know who to deliver to'
            : 'Sign in to order from your neighbourhood'
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {signingUp && (
          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Juan dela Cruz"
            autoCapitalize="words"
            textContentType="name"
          />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          textContentType={signingUp ? 'newPassword' : 'password'}
        />

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label={
            busy
              ? signingUp ? 'Creating account…' : 'Signing in…'
              : signingUp ? 'Create account' : 'Sign in'
          }
          onPress={submit}
          disabled={busy || !email.trim() || !password}
        />
        <TextLink
          label={
            signingUp
              ? 'Already have an account? Sign in'
              : 'New here? Create an account'
          }
          onPress={swapMode}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { padding: spacing.screenPadding },
});
