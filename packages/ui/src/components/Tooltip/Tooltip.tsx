import { type JSX, Show, createSignal, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  label: string;
  children: JSX.Element;
  /** Delay in ms before showing on hover. */
  delay?: number;
  class?: string;
}

/** Lightweight focus-aware tooltip. Wraps the child trigger. */
export function Tooltip(props: TooltipProps): JSX.Element {
  const [own] = splitProps(props, ['label', 'children', 'delay', 'class']);
  const [open, setOpen] = createSignal(false);
  const id = useId('tt');
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const show = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => setOpen(true), own.delay ?? 80);
  };
  const hide = () => {
    clearTimeout(timeout);
    setOpen(false);
  };

  return (
    <span
      class={`${styles.wrap}${own.class ? ` ${own.class}` : ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusIn={show}
      onFocusOut={hide}
      aria-describedby={open() ? id : undefined}
    >
      {own.children}
      <Show when={true}>
        <span role="tooltip" id={id} class={`${styles.bubble} ${open() ? styles.visible : ''}`}>
          {own.label}
        </span>
      </Show>
    </span>
  );
}
