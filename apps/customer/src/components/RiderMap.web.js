import React from 'react';
import RiderSummary from './RiderSummary';

// react-native-maps has no web implementation, and importing it here would
// fail the web bundle outright — Metro resolves imports statically, so even a
// require() behind a Platform check gets pulled in. Splitting by file
// extension is the only way to keep the module off this platform entirely.
//
// The customer app runs in a browser for testing, so web gets the same facts
// as text rather than a broken screen.
export default function RiderMap({ order, freshness }) {
  return <RiderSummary order={order} freshness={freshness} />;
}
