import { View, Text, StyleSheet } from 'react-native';

export default function MealPlanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🥗</Text>
      <Text style={styles.title}>Wochenplan</Text>
      <Text style={styles.subtitle}>Kommt in Phase 3</Text>
      <Text style={styles.hint}>
        Hier kannst du bald Mahlzeiten für jeden Tag der Woche planen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 32,
  },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#2E7D32', fontWeight: '600', marginBottom: 12 },
  hint: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
});
