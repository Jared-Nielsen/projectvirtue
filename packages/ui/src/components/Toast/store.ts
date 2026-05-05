import { createSignal } from 'solid-js';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface ToastEntry {
  id: number;
  title?: string;
  body: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

const [items, setItems] = createSignal<ToastEntry[]>([]);
let counter = 0;

function dismiss(id: number) {
  setItems((list) => list.filter((entry) => entry.id !== id));
}

function push(variant: ToastVariant, body: string, options: ToastOptions = {}): number {
  counter += 1;
  const id = counter;
  const duration = options.duration ?? 4000;
  const entry: ToastEntry = {
    id,
    body,
    variant,
    duration,
    ...(options.title !== undefined ? { title: options.title } : {}),
  };
  setItems((list) => [...list, entry]);
  if (duration > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

/**
 * Toast singleton API. Mount `<ToastViewport />` once near the root, then call
 * `toast.success('Saved!')` from anywhere in the tree.
 */
export const toast = {
  success: (body: string, options?: ToastOptions) => push('success', body, options),
  error: (body: string, options?: ToastOptions) => push('error', body, options),
  warning: (body: string, options?: ToastOptions) => push('warning', body, options),
  info: (body: string, options?: ToastOptions) => push('info', body, options),
  show: (body: string, options?: ToastOptions) => push('default', body, options),
  dismiss,
};

export const toastItems = items;
