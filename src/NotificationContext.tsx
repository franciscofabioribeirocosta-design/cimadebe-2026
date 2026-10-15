import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly message?: string;
  readonly type: NotificationType;
  readonly durationMs?: number;
  readonly timestamp: number;
}

interface NotificationContextType {
  readonly notifications: readonly NotificationItem[];
  readonly notify: (
    title: string,
    message?: string,
    type?: NotificationType,
    durationMs?: number
  ) => string;
  readonly notifySuccess: (title: string, message?: string, durationMs?: number) => string;
  readonly notifyError: (title: string, message?: string, durationMs?: number) => string;
  readonly notifyWarning: (title: string, message?: string, durationMs?: number) => string;
  readonly notifyInfo: (title: string, message?: string, durationMs?: number) => string;
  readonly dismiss: (id: string) => void;
  readonly clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { readonly children: ReactNode }) {
  const [notifications, setNotifications] = useState<readonly NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback(
    (
      title: string,
      message?: string,
      type: NotificationType = 'info',
      durationMs: number = 5000
    ) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newItem: NotificationItem = {
        id,
        title,
        message,
        type,
        durationMs,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [...prev.slice(-4), newItem]); // Mantém no máximo 5 notificações empilhadas

      if (durationMs > 0) {
        setTimeout(() => {
          setNotifications((current) => current.filter((item) => item.id !== id));
        }, durationMs);
      }

      return id;
    },
    []
  );

  const notifySuccess = useCallback(
    (title: string, message?: string, durationMs: number = 4500) => {
      return notify(title, message, 'success', durationMs);
    },
    [notify]
  );

  const notifyError = useCallback(
    (title: string, message?: string, durationMs: number = 7000) => {
      return notify(title, message, 'error', durationMs);
    },
    [notify]
  );

  const notifyWarning = useCallback(
    (title: string, message?: string, durationMs: number = 5500) => {
      return notify(title, message, 'warning', durationMs);
    },
    [notify]
  );

  const notifyInfo = useCallback(
    (title: string, message?: string, durationMs: number = 4000) => {
      return notify(title, message, 'info', durationMs);
    },
    [notify]
  );

  const value = useMemo(
    () => ({
      notifications,
      notify,
      notifySuccess,
      notifyError,
      notifyWarning,
      notifyInfo,
      dismiss,
      clearAll,
    }),
    [notifications, notify, notifySuccess, notifyError, notifyWarning, notifyInfo, dismiss, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification deve ser utilizado dentro de um NotificationProvider.');
  }
  return context;
}
