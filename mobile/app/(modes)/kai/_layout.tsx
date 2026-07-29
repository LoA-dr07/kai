import { Stack } from 'expo-router';

export default function KaiLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
