import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemePref = 'light' | 'dark' | 'system';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  type: 'info' | 'warning' | 'error';
};

export const useUiStore = create(
  persist<{
    sidebarCollapsed: boolean;
    selectedOrganizationId: number | null;
    setSidebarCollapsed: (v: boolean) => void;
    setSelectedOrganizationId: (id: number | null) => void;
  }>(
    (set) => ({
      sidebarCollapsed: false,
      selectedOrganizationId: null,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSelectedOrganizationId: (selectedOrganizationId) => set({ selectedOrganizationId }),
    }),
    { name: 'portal-ui' },
  ),
);

export const useMobileSidebar = create<{
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

export const useNotifications = create<{
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
}>((set) => ({
  notifications: [],
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: String(Date.now()), createdAt: Date.now(), read: false },
        ...s.notifications,
      ],
    })),
}));

export const useThemePref = create(
  persist<{ theme: ThemePref; setTheme: (t: ThemePref) => void }>(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'portal-theme' },
  ),
);
