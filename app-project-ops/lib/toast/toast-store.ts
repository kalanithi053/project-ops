import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast_${(counter += 1)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

const DEFAULT_DURATION = 2000;
const API_TOAST_LOCK_MS = 100;

let apiToastLock:
  | { id: string; variant: ToastVariant; expiresAt: number }
  | undefined;

function show(variant: ToastVariant, title: string, description?: string) {
  if (
    apiToastLock?.variant === variant &&
    apiToastLock.expiresAt > Date.now()
  ) {
    return apiToastLock.id;
  }

  return useToastStore.getState().push({
    variant,
    title,
    description,
    duration: DEFAULT_DURATION,
  });
}

/**
 * Show the server's response message and briefly suppress a hook-level toast
 * for the same request. React Query invokes mutation callbacks immediately
 * after apiFetch resolves, so this prevents duplicate success/error notices.
 */
function showApiResponse(
  variant: ToastVariant,
  title: string,
  description?: string,
) {
  const id = useToastStore.getState().push({
    variant,
    title,
    description,
    duration: DEFAULT_DURATION,
  });
  apiToastLock = {
    id,
    variant,
    expiresAt: Date.now() + API_TOAST_LOCK_MS,
  };
  return id;
}

/** Fire a toast from anywhere (components, hooks, query cache callbacks). */
export const toast = {
  success: (title: string, description?: string) =>
    show("success", title, description),
  error: (title: string, description?: string) =>
    show("error", title, description),
  info: (title: string, description?: string) =>
    show("info", title, description),
  apiSuccess: (message: string) =>
    showApiResponse("success", "Success", message),
  apiError: (message: string) => showApiResponse("error", "Error", message),
};
