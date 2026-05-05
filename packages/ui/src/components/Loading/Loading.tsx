import type { JSX } from 'solid-js';
import { Icon } from '../Icon/Icon';
import styles from './Loading.module.css';

export interface SpinnerProps {
  size?: number;
  label?: string;
  class?: string;
}

export function Spinner(props: SpinnerProps): JSX.Element {
  return (
    <span class={`${styles.spinner}${props.class ? ` ${props.class}` : ''}`}>
      <Icon name="spinner" spin size={props.size ?? 24} label={props.label ?? 'Loading'} />
    </span>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  class?: string;
}

export function Skeleton(props: SkeletonProps): JSX.Element {
  const radius = () => {
    switch (props.rounded ?? 'md') {
      case 'sm':
        return 'var(--br-radius-sm)';
      case 'lg':
        return 'var(--br-radius-lg)';
      case 'full':
        return 'var(--br-radius-full)';
      default:
        return 'var(--br-radius-md)';
    }
  };
  return (
    <span
      class={`${styles.skeleton}${props.class ? ` ${props.class}` : ''}`}
      style={{
        width: typeof props.width === 'number' ? `${props.width}px` : (props.width ?? '100%'),
        height: typeof props.height === 'number' ? `${props.height}px` : (props.height ?? '1em'),
        'border-radius': radius(),
      }}
      aria-hidden="true"
    />
  );
}

export interface LoadingProps {
  label?: string;
}

/** A full-area loading indicator with text. */
export function Loading(props: LoadingProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        gap: 'var(--br-space-2)',
        padding: 'var(--br-space-6)',
        color: 'var(--br-text-muted)',
        'font-family': 'var(--br-font-ui)',
      }}
    >
      <Spinner />
      <span>{props.label ?? 'Loading…'}</span>
    </div>
  );
}
