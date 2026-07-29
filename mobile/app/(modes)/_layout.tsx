import { Stack } from 'expo-router';
import { View } from 'react-native';
import { ModeSwitcher } from '../../components/AppShell/ModeSwitcher';
import { useOrientation } from '../../lib/hooks/useOrientation';

// NOTE: this deliberately does NOT use expo-router's <Tabs>. A Tabs navigator
// with a nested <Stack> per tab does not reliably hide the inactive tab's
// scene on web (react-native-screens' display-toggling doesn't apply there),
// so switching modes left both screens mounted and visually stacked. Plain
// <Stack> navigation between two sibling routes doesn't have that problem —
// see docs/wireframes-mobile.html / -tablet.html "Konzept B" for the intended
// shell (a persistent mode pill/sidebar around whichever mode is active).
export default function ModesLayout() {
  const { isTablet, isLandscape } = useOrientation();
  const isSidebar = isTablet && isLandscape;

  return (
    <View style={{ flex: 1, flexDirection: isSidebar ? 'row' : 'column' }}>
      {isSidebar && <ModeSwitcher variant="sidebar" />}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="kai" />
          <Stack.Screen name="tools" />
        </Stack>
      </View>
      {!isSidebar && <ModeSwitcher variant="pill" />}
    </View>
  );
}
