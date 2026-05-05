import { type JSX, splitProps } from 'solid-js';
import styles from './Card.module.css';

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function Card(props: CardProps): JSX.Element {
  const [own, rest] = splitProps(props, ['class', 'children']);
  return (
    <div class={`${styles.card}${own.class ? ` ${own.class}` : ''}`} {...rest}>
      {own.children}
    </div>
  );
}

export function Panel(props: CardProps): JSX.Element {
  const [own, rest] = splitProps(props, ['class', 'children']);
  return (
    <div class={`${styles.panel}${own.class ? ` ${own.class}` : ''}`} {...rest}>
      {own.children}
    </div>
  );
}
