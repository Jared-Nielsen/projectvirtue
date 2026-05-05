import { type JSX, Show, splitProps } from 'solid-js';
import styles from './HUD.module.css';

export interface BarProps {
  label?: string;
  value: number;
  max?: number;
  /** Show the numeric "value/max" overlay. Defaults to true. */
  showValue?: boolean;
  class?: string;
}

interface InternalBarProps extends BarProps {
  fillVariant: 'health' | 'mana' | 'stat';
  ariaLabel: string;
}

function Bar(props: InternalBarProps): JSX.Element {
  const [own] = splitProps(props, [
    'label',
    'value',
    'max',
    'showValue',
    'class',
    'fillVariant',
    'ariaLabel',
  ]);
  const max = () => own.max ?? 100;
  const pct = () => Math.max(0, Math.min(100, (own.value / max()) * 100));
  return (
    <div class={`${styles.bar}${own.class ? ` ${own.class}` : ''}`}>
      <Show when={own.label}>
        <span class={styles.barLabel}>
          <span>{own.label}</span>
          <span>
            {own.value}/{max()}
          </span>
        </span>
      </Show>
      <div
        class={styles.barTrack}
        role="progressbar"
        aria-label={own.ariaLabel}
        aria-valuenow={own.value}
        aria-valuemin={0}
        aria-valuemax={max()}
      >
        <div
          class={`${styles.barFill} ${styles[own.fillVariant]}`}
          style={{ width: `${pct()}%` }}
        />
        <Show when={!own.label && (own.showValue ?? true)}>
          <span class={styles.value}>
            {own.value}/{max()}
          </span>
        </Show>
      </div>
    </div>
  );
}

export function HealthBar(props: BarProps): JSX.Element {
  return <Bar {...props} fillVariant="health" ariaLabel="Health" />;
}

export function ManaBar(props: BarProps): JSX.Element {
  return <Bar {...props} fillVariant="mana" ariaLabel="Mana" />;
}

export interface StatGaugeProps extends BarProps {
  ariaLabel?: string;
}

export function StatGauge(props: StatGaugeProps): JSX.Element {
  const [own, rest] = splitProps(props, ['ariaLabel']);
  return <Bar {...rest} fillVariant="stat" ariaLabel={own.ariaLabel ?? 'Stat'} />;
}

export interface MinimapPlaceholderProps {
  /** Optional accessible label. */
  label?: string;
  class?: string;
}

export function MinimapPlaceholder(props: MinimapPlaceholderProps): JSX.Element {
  return (
    <div
      class={`${styles.minimap}${props.class ? ` ${props.class}` : ''}`}
      role="img"
      aria-label={props.label ?? 'Minimap'}
    />
  );
}
