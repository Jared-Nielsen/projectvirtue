import { type JSX, Show, createEffect, onCleanup, splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useEscape } from '../../hooks/useEscape';
import { useId } from '../../hooks/useId';
import { FocusTrap } from '../FocusTrap/FocusTrap';
import { Icon } from '../Icon/Icon';
import styles from './Drawer.module.css';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  title?: string;
  hideClose?: boolean;
  children?: JSX.Element;
}

/** Side-anchored drawer with focus trap and Escape-to-close. */
export function Drawer(props: DrawerProps): JSX.Element {
  const [own] = splitProps(props, ['open', 'onClose', 'side', 'title', 'hideClose', 'children']);
  const titleId = useId('drawer-title');

  useEscape(
    () => own.onClose(),
    () => own.open,
  );

  createEffect(() => {
    if (typeof document === 'undefined') return;
    if (own.open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.body.style.overflow = previous;
      });
    }
  });

  return (
    <Show when={own.open}>
      <Portal>
        <div class={styles.overlay} onClick={own.onClose} />
        <FocusTrap>
          <aside
            class={`${styles.panel} ${own.side === 'left' ? styles.left : styles.right}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={own.title ? titleId : undefined}
          >
            <Show when={own.title || !own.hideClose}>
              <div class={styles.header}>
                <Show when={own.title}>
                  <span class={styles.title} id={titleId}>
                    {own.title}
                  </span>
                </Show>
                <Show when={!own.hideClose}>
                  <button
                    type="button"
                    class={styles.close}
                    aria-label="Close"
                    onClick={own.onClose}
                  >
                    <Icon name="x" />
                  </button>
                </Show>
              </div>
            </Show>
            <div class={styles.body}>{own.children}</div>
          </aside>
        </FocusTrap>
      </Portal>
    </Show>
  );
}
