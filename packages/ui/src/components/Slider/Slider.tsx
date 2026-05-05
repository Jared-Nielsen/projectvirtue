import { For, type JSX, Show, createSignal, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Slider.module.css';

export interface SliderProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onInput'> {
  label?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  marks?: { value: number; label: string }[];
  showValue?: boolean;
  onValueChange?: (value: number) => void;
}

export function Slider(props: SliderProps): JSX.Element {
  const [own, rest] = splitProps(props, [
    'label',
    'value',
    'defaultValue',
    'min',
    'max',
    'step',
    'marks',
    'showValue',
    'onValueChange',
    'class',
    'id',
  ]);
  const generated = useId('slider');
  const id = () => own.id ?? generated;
  const min = () => own.min ?? 0;
  const max = () => own.max ?? 100;
  const [internal, setInternal] = createSignal(own.value ?? own.defaultValue ?? min());
  const current = () => own.value ?? internal();

  return (
    <div class={`${styles.field}${own.class ? ` ${own.class}` : ''}`}>
      <Show when={own.label}>
        <label class={styles.label} for={id()}>
          {own.label}
        </label>
      </Show>
      <div class={styles.row}>
        <input
          id={id()}
          class={styles.input}
          type="range"
          min={min()}
          max={max()}
          step={own.step ?? 1}
          value={current()}
          aria-valuenow={current()}
          aria-valuemin={min()}
          aria-valuemax={max()}
          onInput={(e) => {
            const next = Number(e.currentTarget.value);
            setInternal(next);
            own.onValueChange?.(next);
          }}
          {...rest}
        />
        <Show when={own.showValue ?? true}>
          <span class={styles.value}>{current()}</span>
        </Show>
      </div>
      <Show when={own.marks && own.marks.length > 0}>
        <div class={styles.marks} aria-hidden="true">
          <For each={own.marks}>{(m) => <span>{m.label}</span>}</For>
        </div>
      </Show>
    </div>
  );
}
