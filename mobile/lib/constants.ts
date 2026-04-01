import type { MealType } from './types';

export const DAYS_DE = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

export const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Frühstück', icon: '🍳' },
  { key: 'lunch', label: 'Mittagessen', icon: '🥗' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
  { key: 'dinner', label: 'Abendessen', icon: '🍽' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
];

/** Default stale time for React Query queries (5 minutes). */
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;
