import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Conversation } from '../lib/types';
import { Colors, Radii, Spacing } from '../lib/theme';
import { Tooltip } from './Tooltip';

interface ConversationListProps {
  conversations: Conversation[];
  activeConvId: number | null;
  onSelect: (conv: Conversation) => void;
  onDelete: (convId: number) => void;
  onNew: () => void;
}

export function ConversationList({ conversations, activeConvId, onSelect, onDelete, onNew }: ConversationListProps) {
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.newConvRow} onPress={onNew}>
        <Text style={styles.newConvRowText}>+ Neue Konversation</Text>
      </TouchableOpacity>
      <ScrollView>
        {conversations.length === 0 ? (
          <Text style={styles.empty}>Keine gespeicherten Konversationen</Text>
        ) : (
          conversations.map(conv => (
            <View key={conv.id} style={[styles.row, activeConvId === conv.id && styles.rowActive]}>
              <TouchableOpacity style={styles.rowContent} onPress={() => onSelect(conv)}>
                <Text style={[styles.title, activeConvId === conv.id && styles.titleActive]} numberOfLines={2}>
                  {conv.title ?? 'Unbenannte Konversation'}
                </Text>
                <Text style={styles.meta}>
                  {conv.message_count} Nachrichten · {new Date(conv.updated_at).toLocaleDateString('de-DE')}
                </Text>
              </TouchableOpacity>
              <Tooltip label="Konversation löschen" position="left">
                <TouchableOpacity onPress={() => onDelete(conv.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.delete}>🗑</Text>
                </TouchableOpacity>
              </Tooltip>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  newConvRow: { margin: Spacing.md, backgroundColor: Colors.cyan, borderRadius: Radii.md, paddingVertical: 12, alignItems: 'center' },
  newConvRowText: { color: Colors.night, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowActive: { backgroundColor: Colors.cyanSoft },
  rowContent: { flex: 1 },
  title: { fontWeight: '600', color: Colors.ink },
  titleActive: { color: Colors.cyanDark, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  delete: { fontSize: 16, paddingHorizontal: 8 },
});
