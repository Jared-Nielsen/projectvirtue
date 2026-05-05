import { For, type JSX, Show, createMemo, createSignal, splitProps } from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Combobox.module.css';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  label?: string;
  options: ComboboxOption[];
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Optional class on the wrapping label. */
  class?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Single-select combobox with type-ahead filtering.
 * Implements the WAI-ARIA combobox-with-listbox pattern.
 */
export function Combobox(props: ComboboxProps): JSX.Element {
  const [own] = splitProps(props, [
    'label',
    'options',
    'value',
    'placeholder',
    'onChange',
    'class',
    'id',
    'disabled',
  ]);
  const generated = useId('cmbx');
  const id = () => own.id ?? generated;
  const listId = () => `${id()}-list`;
  const [query, setQuery] = createSignal(
    own.options.find((opt) => opt.value === own.value)?.label ?? '',
  );
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);

  const filtered = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return own.options;
    return own.options.filter((opt) => opt.label.toLowerCase().includes(q));
  });

  const commit = (opt: ComboboxOption) => {
    setQuery(opt.label);
    setOpen(false);
    own.onChange?.(opt.value);
  };

  const onKey = (event: KeyboardEvent) => {
    if (own.disabled) return;
    const list = filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((idx) => Math.min(idx + 1, list.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === 'Enter') {
      const opt = list[activeIndex()];
      if (opt) {
        event.preventDefault();
        commit(opt);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <label class={`${styles.field}${own.class ? ` ${own.class}` : ''}`} for={id()}>
      <Show when={own.label}>
        <span class={styles.label}>{own.label}</span>
      </Show>
      <input
        id={id()}
        class={styles.input}
        role="combobox"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={listId()}
        aria-autocomplete="list"
        autocomplete="off"
        disabled={own.disabled}
        placeholder={own.placeholder}
        value={query()}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKey}
      />
      <Show when={open()}>
        <ul id={listId()} class={styles.list} role="listbox" tabIndex={-1}>
          <Show when={filtered().length > 0} fallback={<li class={styles.empty}>No matches</li>}>
            <For each={filtered()}>
              {(opt, idx) => (
                <li
                  class={`${styles.option} ${activeIndex() === idx() ? styles.active : ''}`}
                  role="option"
                  aria-selected={activeIndex() === idx() ? 'true' : 'false'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                  onMouseEnter={() => setActiveIndex(idx())}
                >
                  {opt.label}
                </li>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </label>
  );
}
