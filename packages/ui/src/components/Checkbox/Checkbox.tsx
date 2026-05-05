import { type JSX, Show, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import { Icon } from '../Icon/Icon';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  const [own, rest] = splitProps(props, ['label', 'class', 'id']);
  const generated = useId('cbx');
  const id = () => own.id ?? generated;
  return (
    <label class={`${styles.field}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <input id={id()} type="checkbox" class={styles.input} {...rest} />
      <span class={styles.box} aria-hidden="true">
        <Icon name="check" />
      </span>
      <Show when={own.label}>
        <span>{own.label}</span>
      </Show>
    </label>
  );
}
