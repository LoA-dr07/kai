import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Conversation, ConversationMessage } from '../types';

const CONV_KEY = ['conversations'];

export function useConversations() {
  const { data = [], isLoading, error, refetch } = useQuery<Conversation[], Error>({
    queryKey: CONV_KEY,
    queryFn: () => api.get('/ai/conversations').then(r => r.data),
  });
  return { data, isLoading, error: error ?? undefined, refetch };
}

export function useConversationMessages(conversationId: number | null) {
  const { data = [], isLoading } = useQuery<ConversationMessage[], Error>({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => api.get(`/ai/conversations/${conversationId}/messages`).then(r => r.data),
    enabled: conversationId !== null,
  });
  return { data, isLoading };
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation<Conversation, Error, { title?: string }>({
    mutationFn: payload => api.post('/ai/conversations', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONV_KEY }),
  });
}

export function useUpdateConversationTitle() {
  const qc = useQueryClient();
  return useMutation<Conversation, Error, { id: number; title: string }>({
    mutationFn: ({ id, title }) => api.patch(`/ai/conversations/${id}`, { title }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONV_KEY }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: id => api.delete(`/ai/conversations/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONV_KEY }),
  });
}
