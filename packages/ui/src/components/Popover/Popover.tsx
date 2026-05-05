import { type JSX, Show, createSignal, onCleanup, splitProps } from 'solid-js';
import { useEscape } from '../../hooks/useEscape';
import styles from './Popover.module.css';

export interface PopoverProps {
  /** Controlled open state. Pass with `onOpenChange` for full control. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The trigger button content. */
  trigger: JSX.Element;
  children: JSX.Element;
  class?: string;
}

/** Click-to-open popover; closes on Escape or outside click. */
export function Popover(props: PopoverProps): JSX.Element {
  const [own] = splitProps(props, [
    'open',
    'defaultOpen',
    'onOpenChange',
    'trigger',
    'children',
    'class',
  ]);
  const [internal, setInternal] = createSignal(own.defaultOpen ?? false);
  const open = () => own.open ?? internal();
  const setOpen = (next: boolean) => {
    if (own.open === undefined) setInternal(next);
    own.onOpenChange?.(next);
  };

  let wrapRef: HTMLSpanElement | undefined;

  const onDocClick = (event: MouseEvent) => {
    if (!open()) return;
    if (wrapRef && !wrapRef.contains(event.target as Node)) {
      setOpen(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', onDocClick);
    onCleanup(() => document.removeEventListener('mousedown', onDocClick));
  }

  useEscape(() => setOpen(false), open);

  return (
    <span ref={wrapRef} class={`${styles.wrap}${own.class ? ` ${own.class}` : ''}`}>
      <span
        onClick={() => setOpen(!open())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open());
          }
        }}
      >
        {own.trigger}
      </span>
      <Show when={open()}>
        <span class={styles.panel} role="dialog">
          {own.children}
        </span>
      </Show>
    </span>
  );
}
