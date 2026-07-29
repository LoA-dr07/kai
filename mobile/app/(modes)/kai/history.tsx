import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConversationList } from '../../../components/ConversationList';
import { showAlert } from '../../../lib/alert';
import { useConversations, useDeleteConversation } from '../../../lib/hooks/useConversations';
import { Colors, Spacing } from '../../../lib/theme';
import type { Conversation } from '../../../lib/types';

export default function KaiHistoryScreen() {
  const router = useRouter();
  const { data: conversations = [], refetch } = useConversations();
  const deleteConversation = useDeleteConversation();

  const openConversation = (conv: Conversation) => {
    router.push({ pathname: '/kai/chat', params: { conversationId: String(conv.id) } });
  };

  const startNew = () => router.push('/kai/chat');

  const deleteConv = (convId: number) => {
    showAlert('Konversation löschen', 'Diese Konversation wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deleteConversation.mutate(convId, { onSuccess: () => refetch() }),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/kai')}>
          <Ionicons name="chevron-back" size={20} color={Colors.ink} />
          <Text style={styles.backBtnText}>KAI</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Verlauf</Text>
        <View style={{ width: 60 }} />
      </View>
      <ConversationList
        conversations={conversations}
        activeConvId={null}
        onSelect={openConversation}
        onDelete={deleteConv}
        onNew={startNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.xl, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backBtnText: { color: Colors.ink, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.ink },
});
