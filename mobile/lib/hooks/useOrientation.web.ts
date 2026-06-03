import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  // On web, browser window size ≠ device orientation.
  // Orientation-specific layout is native-only; web relies on width breakpoints.
  return { isLandscape: false, isPortrait: true, isTablet: false, width, height };
}
