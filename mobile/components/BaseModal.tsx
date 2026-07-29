import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../lib/theme';

const GREEN = Colors.cyanDark;
const BORDER = Colors.line;

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  /** Left side of the header: usually a title string, but can be a custom
   * element (e.g. a "back" button) for multi-step modals. */
  headerLeft: React.ReactNode;
  /** Extra header content rendered before the close button. */
  headerRight?: React.ReactNode;
  /** Hide the built-in "Schließen" button, e.g. while a save is in progress. */
  closable?: boolean;
  isWide?: boolean;
  maxWidth?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Shared full-screen "pageSheet" modal shell: Modal + header row + close button.
 * Used by AddToMealPlanModal, RecipeDetailModal, AiSuggestionModal, and the
 * meal-plan screen's recipe-picker modal, which all repeated this pattern. */
export function BaseModal({
  visible,
  onClose,
  headerLeft,
  headerRight,
  closable = true,
  isWide,
  maxWidth = 680,
  containerStyle,
  children,
}: BaseModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, isWide && { maxWidth, width: '100%', alignSelf: 'center' }, containerStyle]}>
        <View style={styles.header}>
          {typeof headerLeft === 'string' ? (
            <Text style={styles.headerTitle} numberOfLines={1}>{headerLeft}</Text>
          ) : (
            headerLeft
          )}
          <View style={styles.headerRight}>
            {headerRight}
            {closable && (
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.headerClose}>Schließen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.ink },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerClose: { fontSize: 16, color: GREEN, fontWeight: '600' },
});
