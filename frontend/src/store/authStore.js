import { create } from 'zustand';
import { api } from '../lib/api';

function getInitialDarkMode() {
  try {
    const saved = localStorage.getItem('talklight-dark-mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  isInitialized: false,
  darkMode: getInitialDarkMode(),

  setDarkMode: (value) => {
    set({ darkMode: value });
    localStorage.setItem('talklight-dark-mode', value);
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleDarkMode: () => {
    const { darkMode } = get();
    get().setDarkMode(!darkMode);
  },

  initDarkMode: () => {
    const { darkMode } = get();
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

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
