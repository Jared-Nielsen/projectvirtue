import { For, type JSX, Show, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Radio.module.css';

export interface RadioProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Radio(props: RadioProps): JSX.Element {
  const [own, rest] = splitProps(props, ['label', 'class', 'id']);
  const generated = useId('radio');
  const id = () => own.id ?? generated;
  return (
    <label class={`${styles.field}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <input id={id()} type="radio" class={styles.input} {...rest} />
      <span class={styles.dot} aria-hidden="true" />
      <Show when={own.label}>
        <span>{own.label}</span>
      </Show>
    </label>
  );
}

export interface RadioGroupOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  options: RadioGroupOption[];
  value?: string;
  onChange?: (value: string) => void;
  class?: string;
}

export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const [own] = splitProps(props, ['name', 'label', 'options', 'value', 'onChange', 'class']);
  return (
    <fieldset class={`${styles.group}${own.class ? ` ${own.class}` : ''}`}>
      <Show when={own.label}>
        <legend class={styles.legend}>{own.label}</legend>
      </Show>
      <For each={own.options}>
        {(opt) => (
          <Radio
            name={own.name}
            value={opt.value}
            label={opt.label}
            disabled={opt.disabled}
            checked={own.value === opt.value}
            onChange={(e) => own.onChange?.(e.currentTarget.value)}
          />
        )}
      </For>
    </fieldset>
  );
}
