import {
  type Accessor,
  For,
  type JSX,
  Show,
  createContext,
  createMemo,
  createSignal,
  splitProps,
  useContext,
} from 'solid-js';
import { useId } from '../../hooks/useId';
import styles from './Tabs.module.css';

interface TabsContextValue {
  active: Accessor<string>;
  setActive: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue>();

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  children: JSX.Element;
  class?: string;
  id?: string;
}

export function Tabs(props: TabsProps): JSX.Element {
  const [own] = splitProps(props, ['value', 'defaultValue', 'onChange', 'class', 'id', 'children']);
  const generated = useId('tabs');
  const baseId = own.id ?? generated;
  const [internal, setInternal] = createSignal(own.defaultValue ?? '');

  const active = createMemo(() => own.value ?? internal());
  const setActive = (value: string) => {
    if (own.value === undefined) setInternal(value);
    own.onChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ active, setActive, baseId }}>
      <div class={own.class}>{own.children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: JSX.Element;
  'aria-label'?: string;
}

export function TabList(props: TabListProps): JSX.Element {
  return (
    <div class={styles.tablist} role="tablist" aria-label={props['aria-label']}>
      {props.children}
    </div>
  );
}

export interface TabProps {
  value: string;
  disabled?: boolean;
  children: JSX.Element;
}

export function Tab(props: TabProps): JSX.Element {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('<Tab> must be inside <Tabs>');
  const id = () => `${ctx.baseId}-tab-${props.value}`;
  const panelId = () => `${ctx.baseId}-panel-${props.value}`;
  const selected = () => ctx.active() === props.value;

  return (
    <button
      type="button"
      role="tab"
      id={id()}
      class={styles.tab}
      aria-selected={selected() ? 'true' : 'false'}
      aria-controls={panelId()}
      tabIndex={selected() ? 0 : -1}
      disabled={props.disabled}
      onClick={() => ctx.setActive(props.value)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const tabs = (e.currentTarget.parentElement?.querySelectorAll(
            '[role="tab"]:not([disabled])',
          ) ?? []) as NodeListOf<HTMLButtonElement>;
          const list = Array.from(tabs);
          const index = list.indexOf(e.currentTarget);
          const next =
            e.key === 'ArrowRight'
              ? list[(index + 1) % list.length]
              : list[(index - 1 + list.length) % list.length];
          next?.focus();
          next?.click();
        }
      }}
    >
      {props.children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: JSX.Element;
}

export function TabPanel(props: TabPanelProps): JSX.Element {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('<TabPanel> must be inside <Tabs>');
  const id = () => `${ctx.baseId}-panel-${props.value}`;
  const labelledBy = () => `${ctx.baseId}-tab-${props.value}`;
  return (
    <Show when={ctx.active() === props.value}>
      <div
        role="tabpanel"
        id={id()}
        aria-labelledby={labelledBy()}
        class={styles.panel}
        tabIndex={0}
      >
        {props.children}
      </div>
    </Show>
  );
}
