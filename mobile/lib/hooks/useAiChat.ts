import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { AiChatRequest, AiChatResponse } from '../types';

export function useAiChat() {
  return useMutation<AiChatResponse, Error, AiChatRequest>({
    mutationFn: (payload) =>
      api
        .post<AiChatResponse>('/ai/chat', payload, { timeout: 60_000 })
        .then((r) => r.data),
  });
}
