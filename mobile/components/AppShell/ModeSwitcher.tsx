import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '../../lib/theme';

const TOOL_LINKS: { label: string; href: '/tools/recipes' | '/tools/meal-plan' | '/tools/shopping-list' | '/tools/settings'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Rezepte', href: '/tools/recipes', icon: 'restaurant-outline' },
  { label: 'Wochenplan', href: '/tools/meal-plan', icon: 'calendar-outline' },
  { label: 'Einkaufsliste', href: '/tools/shopping-list', icon: 'cart-outline' },
  { label: 'Einstellungen', href: '/tools/settings', icon: 'settings-outline' },
];

/**
 * Global mode switch (KAI-Modus / Werkzeuge-Modus) rendered by the (modes)
 * layout. "pill" is the fixed bottom bar (phone + tablet portrait); "sidebar"
 * is the persistent left rail (tablet landscape), which also carries a
 * permanent tool nav-stack while Werkzeuge is active.
 */
export function ModeSwitcher({ variant }: { variant: 'pill' | 'sidebar' }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeMode: 'kai' | 'tools' = pathname.startsWith('/tools') ? 'tools' : 'kai';

  const goToMode = (mode: 'kai' | 'tools') => {
    if (mode === activeMode) return;
    router.replace(mode === 'kai' ? '/kai' : '/tools');
  };

  if (variant === 'sidebar') {
    return (
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>K</Text></View>
          <Text style={styles.brandText}>KAI</Text>
        </View>
        <View style={styles.sidebarModePill}>
          <TouchableOpacity
            style={[styles.sidebarModeBtn, activeMode === 'kai' && styles.sidebarModeBtnActive]}
            onPress={() => goToMode('kai')}
          >
            <Text style={[styles.sidebarModeBtnText, activeMode === 'kai' && styles.sidebarModeBtnTextActive]}>✦ KI-Modus</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sidebarModeBtn, activeMode === 'tools' && styles.sidebarModeBtnActive]}
            onPress={() => goToMode('tools')}
          >
            <Text style={[styles.sidebarModeBtnText, activeMode === 'tools' && styles.sidebarModeBtnTextActive]}>▦ Werkzeuge</Text>
          </TouchableOpacity>
        </View>
        {activeMode === 'tools' && (
          <View style={styles.navStack}>
            {TOOL_LINKS.map(link => {
              const isActive = pathname.startsWith(link.href);
              return (
                <TouchableOpacity
                  key={link.href}
                  style={[styles.navStackItem, isActive && styles.navStackItemActive]}
                  onPress={() => router.push(link.href)}
                >
                  <Ionicons name={link.icon} size={18} color={isActive ? '#fff' : '#afc1d1'} />
                  <Text style={[styles.navStackItemText, isActive && styles.navStackItemTextActive]}>{link.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.pillWrap}>
      <View style={styles.pill}>
        <TouchableOpacity
          style={[styles.pillBtn, activeMode === 'kai' && styles.pillBtnActive]}
          onPress={() => goToMode('kai')}
        >
          <Text style={[styles.pillBtnText, activeMode === 'kai' && styles.pillBtnTextActive]}>✦ KAI-Modus</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pillBtn, activeMode === 'tools' && styles.pillBtnActive]}
          onPress={() => goToMode('tools')}
        >
          <Text style={[styles.pillBtnText, activeMode === 'tools' && styles.pillBtnTextActive]}>▦ Werkzeuge</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Portrait bottom pill
  pillWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  pill: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: 4,
    borderRadius: Radii.xl,
    backgroundColor: '#e9edf7',
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  pillBtnActive: {
    backgroundColor: Colors.night,
  },
  pillBtnText: {
    fontWeight: '700',
    color: Colors.muted,
  },
  pillBtnTextActive: {
    color: '#fff',
  },

  // Landscape tablet sidebar
  sidebar: {
    width: 208,
    backgroundColor: Colors.night,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 6, marginBottom: Spacing.lg },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: Colors.cyan, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: Colors.night, fontWeight: '700', fontSize: 17 },
  brandText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  sidebarModePill: { gap: 4 },
  sidebarModeBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: Radii.md },
  sidebarModeBtnActive: { backgroundColor: Colors.cyan },
  sidebarModeBtnText: { color: '#afc1d1', fontWeight: '700' },
  sidebarModeBtnTextActive: { color: Colors.night },
  navStack: { marginTop: Spacing.md, gap: 2 },
  navStackItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: Radii.md },
  navStackItemActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navStackItemText: { color: '#afc1d1', fontWeight: '600', fontSize: 13 },
  navStackItemTextActive: { color: '#fff', fontWeight: '700' },
});
