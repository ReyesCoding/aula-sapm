import api from './api';

export interface ForumAuthor {
  id: number;
  name: string;
  role: string;
}

export interface ForumThread {
  id: number;
  title: string;
  body: string;
  subjectId: number;
  authorId: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor;
  _count: { posts: number };
}

export interface ForumPost {
  id: number;
  threadId: number;
  authorId: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: ForumAuthor;
}

export interface ThreadDetail {
  thread: ForumThread;
  posts: ForumPost[];
  canModerate: boolean;
}

export const getSubjectThreads = async (subjectId: number): Promise<ForumThread[]> => {
  const { data } = await api.get<ForumThread[]>(`/forums/subjects/${subjectId}/threads`);
  return data;
};

export const createThread = async (subjectId: number, title: string, body: string): Promise<ForumThread> => {
  const { data } = await api.post<ForumThread>(`/forums/subjects/${subjectId}/threads`, { title, body });
  return data;
};

export const getThread = async (threadId: number): Promise<ThreadDetail> => {
  const { data } = await api.get<ThreadDetail>(`/forums/threads/${threadId}`);
  return data;
};

export const createPost = async (threadId: number, body: string): Promise<ForumPost> => {
  const { data } = await api.post<ForumPost>(`/forums/threads/${threadId}/posts`, { body });
  return data;
};

export const setThreadLock = async (threadId: number, locked: boolean): Promise<ForumThread> => {
  const { data } = await api.patch<ForumThread>(`/forums/threads/${threadId}/lock`, { locked });
  return data;
};

export const setThreadPin = async (threadId: number, pinned: boolean): Promise<ForumThread> => {
  const { data } = await api.patch<ForumThread>(`/forums/threads/${threadId}/pin`, { pinned });
  return data;
};

export const deletePost = async (postId: number): Promise<void> => {
  await api.delete(`/forums/posts/${postId}`);
};
