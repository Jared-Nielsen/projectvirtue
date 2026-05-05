import { type JSX, splitProps } from 'solid-js';
import { type IconName, iconRegistry } from '../../icons/registry';
import styles from './Icon.module.css';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  name: IconName;
  /** Visual size in CSS units; defaults to `1em` (inherits from font-size). */
  size?: string | number;
  /** Decorative icons hide from a11y tree; named icons get aria-label. */
  label?: string;
  spin?: boolean;
}

export function Icon(props: IconProps): JSX.Element {
  const [own, rest] = splitProps(props, ['name', 'size', 'label', 'class', 'spin']);
  const def = () => iconRegistry[own.name];
  const dim = () =>
    own.size === undefined ? undefined : typeof own.size === 'number' ? `${own.size}px` : own.size;

  return (
    <svg
      class={`${styles.icon}${own.spin ? ` ${styles.spin}` : ''}${own.class ? ` ${own.class}` : ''}`}
      viewBox={def().viewBox ?? '0 0 24 24'}
      width={dim()}
      height={dim()}
      role={own.label ? 'img' : 'presentation'}
      aria-label={own.label}
      aria-hidden={own.label ? undefined : 'true'}
      innerHTML={def().body}
      {...rest}
    />
  );
}
