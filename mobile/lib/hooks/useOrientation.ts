import { useWindowDimensions } from 'react-native';

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.max(width, height) >= 768;
  return { isLandscape, isPortrait: !isLandscape, isTablet, width, height };
}
