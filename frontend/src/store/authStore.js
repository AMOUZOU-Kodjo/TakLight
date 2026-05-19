import { create } from 'zustand';
import { api } from '../lib/api';

export const useAuthStore = create((set) => ({
  user: null,
  isInitialized: false,

  setUser: (user) => set({ user, isInitialized: true }),

  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    set({ user: response.data.user, isInitialized: true });
  },

  register: async (email, username, password) => {
    const response = await api.post('/api/auth/register', { email, username, password });
    set({ user: response.data.user, isInitialized: true });
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      set({ user: null, isInitialized: true });
    }
  },

  fetchMe: async () => {
    try {
      const response = await api.get('/api/auth/me');
      set({ user: response.data.user, isInitialized: true });
    } catch {
      set({ user: null, isInitialized: true });
    }
  },

  updateProfile: async (data) => {
    const response = await api.put('/api/users/me', data);
    set({ user: response.data.user });
  },
}));
