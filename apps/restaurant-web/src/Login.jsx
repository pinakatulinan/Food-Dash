import React, { useState } from 'react';
import { supabase } from './lib/supabase';

// Sign in only — there is deliberately no signup here. A restaurant account
// can accept orders and is owed money, so they're created by hand after a
// commission rate is agreed and payout details are collected.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
    // On success onAuthStateChange swaps this screen out.
  };

  return (
    <>
      <header className="header">
        <h1>Kaon</h1>
        <p>Restaurant dashboard</p>
      </header>
      <main className="login">
        <form className="card" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="cta" type="submit" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="hint">
            No account? Restaurant logins are set up by the Kaon team.
          </p>
        </form>
      </main>
    </>
  );
}
