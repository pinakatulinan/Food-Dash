// theme.js — Design tokens for the food delivery app (Style C: bold header)
// Palette: pastel coral + pastel mint + white
// Usage: import { colors, spacing, radius, typography } from '@kaon/theme';
// Rule of thumb: coral = actions & brand, mint = status & reassurance, white = everything else.

export const colors = {
  // Brand — coral family
  coralPastel: '#FFD9C9',   // Screen headers, passive surfaces, avatars, pills
  coralBorder: '#F5B79E',   // Borders on coral surfaces
  coralDeep: '#D85A30',     // Primary CTAs, add buttons, active nav, ratings — always with white text
  coralTextDark: '#7A3A1F', // Titles on coralPastel backgrounds
  coralTextMid: '#8A4A2F',  // Subtitles on coralPastel backgrounds

  // Status — mint family
  mintPastel: '#CFF0E8',    // Status pills, quantity badges, success states, tags
  mintBorder: '#A6DED1',    // Borders on mint surfaces
  tealTextDark: '#1F5F4F',  // Titles on mintPastel backgrounds
  tealTextMid: '#2F6F5F',   // Subtitles on mintPastel backgrounds

  // Neutrals
  white: '#FFFFFF',         // Backgrounds, cards, pills-on-coral
  surfaceMuted: '#F2F2F2',  // Map placeholders, inactive surfaces
  surfaceSearch: '#F7F7F7', // Search bar fill
  border: '#E2E2E2',        // Card borders, outlined pills
  divider: '#EEEEEE',       // List row dividers (lighter than border)
  textPrimary: '#1A1A1A',   // Main text on white
  textSecondary: '#4A4A4A', // Body text, order line items
  textMuted: '#8A8A8A',     // Hints, metadata, placeholder text
  iconInactive: '#B0B0B0',  // Inactive nav / decorative icons
  scrim: 'rgba(0,0,0,0.35)', // Dimmed backdrop behind modals
};

// Semantic aliases — prefer these in components so a palette
// change later only touches this file.
export const semantic = {
  headerBg: colors.coralPastel,
  headerTitle: colors.coralTextDark,
  headerSubtitle: colors.coralTextMid,
  ctaBg: colors.coralDeep,
  ctaText: colors.white,
  statusBg: colors.mintPastel,
  statusText: colors.tealTextDark,
  statusPillOnHeaderBg: colors.white,        // White pill on coral header
  statusPillOnHeaderText: colors.tealTextDark,
  screenBg: colors.white,
  cardBorder: colors.border,
  rating: colors.coralDeep,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  screenPadding: 16,  // Horizontal padding on all screens
  headerPadding: 16,  // Inside the coral header block
};

export const radius = {
  sm: 8,    // Buttons, search bars, small cards
  md: 10,   // List item cards
  lg: 12,   // Map placeholders, larger cards
  xl: 16,   // Screen container corners
  pill: 999, // Status pills, tags, quantity badges
};

export const typography = {
  // Sizes
  screenTitle: 20,   // Header title ("Kaon ta!", "Your basket")
  sectionTitle: 16,  // Section headers ("Silog meals")
  body: 14,          // Restaurant names, menu items, prices
  caption: 12,       // Metadata, ratings, delivery info
  pill: 11,          // Status pills and tags

  // Weights (React Native fontWeight strings)
  regular: '400',
  medium: '500',     // Use for all emphasis — avoid '600'/'700', too heavy for this style
};

// Style C layout rules (from the approved mockups):
// 1. Every screen opens with a coralPastel header block containing
//    the screen title + key context.
// 2. Exactly ONE coralDeep CTA per screen.
// 3. Mint means status — never use it for actions.
// 4. Status shown ON the coral header uses a white pill with teal text.
// 5. Content below the header stays neutral: white bg, divider lines,
//    muted secondary text.

export default { colors, semantic, spacing, radius, typography };
