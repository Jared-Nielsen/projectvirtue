import { For, type JSX, Show, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import { Icon } from '../Icon/Icon';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

/** Native select primitive — accessible by default, themed via tokens. */
export function Select(props: SelectProps): JSX.Element {
  const [own, rest] = splitProps(props, ['label', 'options', 'placeholder', 'class', 'id']);
  const generated = useId('select');
  const id = () => own.id ?? generated;
  return (
    <label class={`${styles.field}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <Show when={own.label}>
        <span class={styles.label}>{own.label}</span>
      </Show>
      <span class={styles.controlWrap}>
        <select id={id()} class={styles.select} {...rest}>
          <Show when={own.placeholder}>
            <option value="" disabled selected hidden>
              {own.placeholder}
            </option>
          </Show>
          <For each={own.options}>
            {(opt) => (
              <option value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            )}
          </For>
        </select>
        <span class={styles.chevron}>
          <Icon name="chevron-down" />
        </span>
      </span>
    </label>
  );
}
