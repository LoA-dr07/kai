import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  // On web, browser window size ≠ device orientation.
  // Orientation-specific layout is native-only; web relies on width breakpoints.
  const isWide = width >= 768;
  const isUltraWide = width >= 2560;
  return { isLandscape: false, isPortrait: true, isTablet: false, isWide, isUltraWide, width, height };
}
