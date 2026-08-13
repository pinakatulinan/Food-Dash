// Expo's default config detects the npm workspace on its own and watches the
// repo root, so the @food-dash/* packages resolve without help. The manual
// watchFolders / nodeModulesPaths / disableHierarchicalLookup overrides this
// file used to carry were needed on SDK 51; from SDK 52 they fight the
// defaults and expo-doctor flags them.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
