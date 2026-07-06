import { useState } from 'react';
import { getMondayOf, getISOWeek, isoDate } from '../dateUtils';

/** Shared week-selection state (Monday-of-week + prev/next navigation) used by
 * screens/modals that let the user pick a meal-plan week. */
export function useWeekNavigation(initial: Date = new Date()) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(initial));

  const weekStartIso = isoDate(weekStart);
  const weekNum = getISOWeek(weekStart);
  const year = weekStart.getFullYear();

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const resetToToday = () => setWeekStart(getMondayOf(new Date()));

  return { weekStart, setWeekStart, weekStartIso, weekNum, year, navigateWeek, resetToToday };
}
