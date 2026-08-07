import { registerRootComponent } from 'expo';

import App from './App';

// Explicit entry point. The default `expo/AppEntry.js` reaches for '../../App'
// relative to itself, which resolves to the wrong file once the workspace
// hoists `expo` up to the repo root.
registerRootComponent(App);
