import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.max(width, height) >= 768;
  const isWide = width >= 768;
  const isUltraWide = width >= 2560;
  return { isLandscape, isPortrait: !isLandscape, isTablet, isWide, isUltraWide, width, height };
}
