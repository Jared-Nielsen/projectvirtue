import { type JSX, splitProps } from 'solid-js';
import type { IconName } from '../../icons/registry';
import { Button, type ButtonSize, type ButtonVariant } from '../Button/Button';
import { Icon } from '../Icon/Icon';

export interface IconButtonProps
  extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> {
  /** Required for accessibility — used as `aria-label`. */
  label: string;
  icon: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
}

/** Square icon-only button. Always carries an `aria-label`. */
export function IconButton(props: IconButtonProps): JSX.Element {
  const [own, rest] = splitProps(props, ['label', 'icon', 'variant', 'size', 'class']);
  return (
    <Button
      variant={own.variant ?? 'icon'}
      size={own.size ?? 'md'}
      aria-label={own.label}
      {...(own.class !== undefined ? { class: own.class } : {})}
      {...rest}
    >
      <Icon name={own.icon} />
    </Button>
  );
}
