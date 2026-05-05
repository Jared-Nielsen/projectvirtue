import { For, type JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';
import { toast, toastItems } from './store';

/** Mount once near the application root. Renders the toast stack via Portal. */
export function ToastViewport(): JSX.Element {
  return (
    <Portal>
      <div class={styles.stack} role="region" aria-label="Notifications" aria-live="polite">
        <For each={toastItems()}>
          {(entry) => (
            <div
              class={`${styles.toast}${entry.variant !== 'default' ? ` ${styles[entry.variant]}` : ''}`}
              role={entry.variant === 'error' ? 'alert' : 'status'}
            >
              <div>
                <Show when={entry.title}>
                  <div class={styles.title}>{entry.title}</div>
                </Show>
                <div class={styles.body}>{entry.body}</div>
              </div>
              <button
                type="button"
                class={styles.close}
                aria-label="Dismiss notification"
                onClick={() => toast.dismiss(entry.id)}
              >
                <Icon name="x" />
              </button>
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
}

export { toast } from './store';
