"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Conversation, ConversationDetail } from "@/types";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/conversations"),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.get<ConversationDetail>(`/conversations/${id}`),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      api.post<Conversation>("/conversations", { title: title ?? "New Chat" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useAddMessage() {
  return useMutation({
    mutationFn: ({
      conversationId,
      role,
      content,
    }: {
      conversationId: string;
      role: string;
      content: string;
    }) =>
      api.post(`/conversations/${conversationId}/messages`, { role, content }),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<Conversation>(`/conversations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
