import { type JSX, Show, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Input.module.css';

export type InputType = 'text' | 'number' | 'password' | 'search' | 'email' | 'tel' | 'url';

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType;
  label?: string;
  helperText?: string;
  errorText?: string;
  invalid?: boolean;
  required?: boolean;
  /** Optional content shown left of the input (e.g. an Icon). */
  leadingAddon?: JSX.Element;
  /** Optional content shown right of the input. */
  trailingAddon?: JSX.Element;
}

/** Labelled text input. Pairs label, control, and helper/error text. */
export function Input(props: InputProps): JSX.Element {
  const [own, rest] = splitProps(props, [
    'type',
    'label',
    'helperText',
    'errorText',
    'invalid',
    'required',
    'leadingAddon',
    'trailingAddon',
    'class',
    'id',
    'disabled',
  ]);
  const generated = useId('input');
  const id = () => own.id ?? generated;
  const helperId = () => `${id()}-helper`;
  const errorId = () => `${id()}-error`;
  const isInvalid = () => own.invalid || !!own.errorText;
  const wrapClass = () =>
    [styles.controlWrap, isInvalid() ? styles.error : '', own.disabled ? styles.disabled : '']
      .filter(Boolean)
      .join(' ');

  return (
    <label class={`${styles.field}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <Show when={own.label}>
        <span class={styles.label}>
          {own.label}
          <Show when={own.required}>
            <span class={styles.required} aria-hidden="true">
              *
            </span>
          </Show>
        </span>
      </Show>
      <span class={wrapClass()}>
        <Show when={own.leadingAddon}>
          <span class={styles.addon}>{own.leadingAddon}</span>
        </Show>
        <input
          id={id()}
          class={styles.input}
          type={own.type ?? 'text'}
          aria-invalid={isInvalid() ? 'true' : undefined}
          aria-describedby={own.errorText ? errorId() : own.helperText ? helperId() : undefined}
          required={own.required}
          disabled={own.disabled}
          {...rest}
        />
        <Show when={own.trailingAddon}>
          <span class={styles.addon}>{own.trailingAddon}</span>
        </Show>
      </span>
      <Show when={own.errorText}>
        <span id={errorId()} class={`${styles.helper} ${styles.helperError}`}>
          {own.errorText}
        </span>
      </Show>
      <Show when={!own.errorText && own.helperText}>
        <span id={helperId()} class={styles.helper}>
          {own.helperText}
        </span>
      </Show>
    </label>
  );
}
