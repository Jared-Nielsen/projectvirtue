import { type JSX, Show, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Toggle.module.css';

export interface ToggleProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/** Switch-style boolean toggle. Uses native checkbox for a11y semantics. */
export function Toggle(props: ToggleProps): JSX.Element {
  const [own, rest] = splitProps(props, ['label', 'class', 'id']);
  const generated = useId('toggle');
  const id = () => own.id ?? generated;
  return (
    <label class={`${styles.toggle}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <input id={id()} class={styles.input} type="checkbox" role="switch" {...rest} />
      <span class={styles.track}>
        <span class={styles.thumb} />
      </span>
      <Show when={own.label}>
        <span>{own.label}</span>
      </Show>
    </label>
  );
}
