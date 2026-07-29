/** Shared color and style constants for the KAI app. */

import { Platform } from 'react-native';

// Brand palette (KAI redesign, "Konzept B" — see docs/wireframes-mobile.html / -tablet.html)
export const Colors = {
  night: '#16133e',
  blue: '#13335b',
  cyan: '#06b6d4',
  cyanSoft: '#dff8fc',
  cyanDark: '#087f94',
  paper: '#f5f9fc',
  surface: '#ffffff',
  line: '#d8e5ed',
  muted: '#607487',
  peach: '#f5a994',
  greenAccent: '#dff3e9',
  greenAccentInk: '#216b52',
  danger: '#b7495e',
  ink: '#16133e',
} as const;

export const Fonts = {
  display: Platform.select({ web: '"Bricolage Grotesque", sans-serif', default: undefined }),
  displayBold: Platform.select({ web: '"Bricolage Grotesque", sans-serif', default: undefined }),
  body: Platform.select({ web: '"Atkinson Hyperlegible", sans-serif', default: undefined }),
  bodyBold: Platform.select({ web: '"Atkinson Hyperlegible", sans-serif', default: undefined }),
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
