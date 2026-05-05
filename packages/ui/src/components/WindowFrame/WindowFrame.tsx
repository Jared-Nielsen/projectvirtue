import { type JSX, Show, splitProps } from 'solid-js';
import { Icon } from '../Icon/Icon';
import styles from './WindowFrame.module.css';

export interface WindowFrameProps extends JSX.HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Render a close button in the title bar. Calls `onClose` when activated. */
  onClose?: () => void;
}

/** Parchment / fantasy-game styled container. Used for HUD panels & in-game windows. */
export function WindowFrame(props: WindowFrameProps): JSX.Element {
  const [own, rest] = splitProps(props, ['title', 'onClose', 'class', 'children']);
  return (
    <div class={`${styles.frame}${own.class ? ` ${own.class}` : ''}`} {...rest}>
      <Show when={own.title || own.onClose}>
        <div class={styles.title}>
          <Show when={own.title}>
            <span class={styles.titleText}>{own.title}</span>
          </Show>
          <Show when={own.onClose}>
            <button type="button" class={styles.close} aria-label="Close" onClick={own.onClose}>
              <Icon name="x" />
            </button>
          </Show>
        </div>
      </Show>
      <div class={styles.body}>{own.children}</div>
    </div>
  );
}
