import { type JSX, Show, splitProps } from 'solid-js';
import { Icon } from '../Icon/Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Optional content rendered before the label. */
  leadingIcon?: JSX.Element;
  /** Optional content rendered after the label. */
  trailingIcon?: JSX.Element;
  /** Native button type — defaults to "button" so it never accidentally submits forms. */
  type?: 'button' | 'submit' | 'reset';
}

/** Solid-js Button primitive. Forwards class via `class`. */
export function Button(props: ButtonProps): JSX.Element {
  const [own, rest] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'leadingIcon',
    'trailingIcon',
    'class',
    'children',
    'type',
    'disabled',
  ]);
  const variant = (): ButtonVariant => own.variant ?? 'primary';
  const size = (): ButtonSize => own.size ?? 'md';
  const cls = () =>
    [
      styles.btn,
      styles[size()],
      styles[variant()],
      own.loading ? styles.loading : '',
      own.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <button
      type={own.type ?? 'button'}
      class={cls()}
      disabled={own.disabled || own.loading}
      aria-busy={own.loading ? 'true' : undefined}
      {...rest}
    >
      <span class={`${styles.label} ${own.loading ? styles.hideLabel : ''}`}>
        <Show when={own.leadingIcon}>{(node) => <span aria-hidden="true">{node()}</span>}</Show>
        {own.children}
        <Show when={own.trailingIcon}>{(node) => <span aria-hidden="true">{node()}</span>}</Show>
      </span>
      <Show when={own.loading}>
        <span class={styles.spinnerOverlay} aria-hidden="true">
          <Icon name="spinner" spin />
        </span>
      </Show>
    </button>
  );
}
