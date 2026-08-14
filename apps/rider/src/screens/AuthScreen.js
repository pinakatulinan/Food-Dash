import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ScreenHeader, Button, Input, ErrorText, LinkButton } from '@food-dash/ui';
import { colors, browse, spacing } from '@food-dash/theme';
import { supabase } from '../lib/supabase';

// Rider accounts are separate from customer accounts — same person, two
// sign-ups. Signing up here sets role: 'rider', which the database trigger
// uses to create the riders row (starting unapproved).
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
          options: { data: { full_name: fullName.trim(), role: 'rider' } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }

    if (!data.session) {
      setError('Account created, but it needs confirming before you can sign in.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        size="large"
        title={signingUp ? 'Ride with Food-Dash' : 'Food-Dash Rider'}
        subtitle={
          signingUp
            ? 'We’ll check your documents before you can start'
            : 'Sign in to start delivering'
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {signingUp && (
          <Input
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Juan dela Cruz"
            autoCapitalize="words"
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
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
        />

        <ErrorText>{error}</ErrorText>

        <Button
          size="large"
          label={busy ? 'Please wait…' : signingUp ? 'Apply to ride' : 'Sign in'}
          onPress={submit}
          disabled={busy || !email.trim() || !password}
        />
        <LinkButton
          label={signingUp ? 'Already applied? Sign in' : 'New rider? Apply here'}
          onPress={() => { setSigningUp(!signingUp); setError(null); }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: browse.pageBg },
  body: { padding: spacing.screenPadding },
});
