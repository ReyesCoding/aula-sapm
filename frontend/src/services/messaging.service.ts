import api from './api';

export interface MessagingContact {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  role: string;
}

export type ConversationType = 'DIRECT' | 'GROUP' | 'ANNOUNCEMENT';

export interface MessageAttachment {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  attachments: MessageAttachment[];
}

export interface ConversationSummary {
  conversationId: number;
  type: ConversationType;
  subject: string | null;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetail {
  conversation: {
    id: number;
    type: ConversationType;
    subject: string | null;
    participants: ConversationParticipant[];
  };
  messages: Message[];
  nextCursor: number | null;
}

export const getContacts = async (): Promise<MessagingContact[]> => {
  const { data } = await api.get<MessagingContact[]>('/messages/contacts');
  return data;
};

export const getConversations = async (): Promise<ConversationSummary[]> => {
  const { data } = await api.get<ConversationSummary[]>('/messages/conversations');
  return data;
};

export const getConversation = async (conversationId: number): Promise<ConversationDetail> => {
  const { data } = await api.get<ConversationDetail>(`/messages/conversations/${conversationId}`);
  return data;
};

export const createConversation = async (
  participantIds: number[],
  firstMessage: string,
): Promise<{ conversationId: number } | { id: number }> => {
  const { data } = await api.post('/messages/conversations', { participantIds, firstMessage });
  return data;
};

export const sendMessage = async (conversationId: number, body: string, file?: File | null): Promise<Message> => {
  if (file) {
    const formData = new FormData();
    if (body) formData.append('body', body);
    formData.append('file', file);
    const { data } = await api.post<Message>(`/messages/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const { data } = await api.post<Message>(`/messages/conversations/${conversationId}/messages`, { body });
  return data;
};

export const markConversationRead = async (conversationId: number): Promise<void> => {
  await api.patch(`/messages/conversations/${conversationId}/read`);
};

export const getGlobalUnreadCount = async (): Promise<number> => {
  const { data } = await api.get<{ count: number }>('/messages/unread-count');
  return data.count;
};
