import { type JSX, splitProps } from 'solid-js';

type SpaceKey =
  | '0'
  | '0_5'
  | '1'
  | '1_5'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '8'
  | '10'
  | '12'
  | '16'
  | '20'
  | '24';

const space = (key: SpaceKey): string => `var(--br-space-${key})`;

export interface StackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  gap?: SpaceKey;
  align?: JSX.CSSProperties['align-items'];
  justify?: JSX.CSSProperties['justify-content'];
}

/** Vertical stack — `flex-direction: column` with token-based gap. */
export function Stack(props: StackProps): JSX.Element {
  const [own, rest] = splitProps(props, ['gap', 'align', 'justify', 'style', 'children']);
  const style = (): JSX.CSSProperties => ({
    display: 'flex',
    'flex-direction': 'column',
    gap: space(own.gap ?? '3'),
    ...(own.align !== undefined ? { 'align-items': own.align } : {}),
    ...(own.justify !== undefined ? { 'justify-content': own.justify } : {}),
    ...((own.style as JSX.CSSProperties | undefined) ?? {}),
  });
  return (
    <div style={style()} {...rest}>
      {own.children}
    </div>
  );
}

export interface ClusterProps extends JSX.HTMLAttributes<HTMLDivElement> {
  gap?: SpaceKey;
  wrap?: boolean;
  align?: JSX.CSSProperties['align-items'];
  justify?: JSX.CSSProperties['justify-content'];
}

/** Horizontal cluster — `flex` row, optional wrap. */
export function Cluster(props: ClusterProps): JSX.Element {
  const [own, rest] = splitProps(props, ['gap', 'wrap', 'align', 'justify', 'style', 'children']);
  const style = (): JSX.CSSProperties => ({
    display: 'flex',
    'flex-direction': 'row',
    'flex-wrap': (own.wrap ?? true) ? 'wrap' : 'nowrap',
    gap: space(own.gap ?? '3'),
    'align-items': own.align ?? 'center',
    ...(own.justify !== undefined ? { 'justify-content': own.justify } : {}),
    ...((own.style as JSX.CSSProperties | undefined) ?? {}),
  });
  return (
    <div style={style()} {...rest}>
      {own.children}
    </div>
  );
}

export interface GridProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Min column width — used in auto-fill responsive grid. */
  minColumn?: string;
  columns?: number;
  gap?: SpaceKey;
}

/** Responsive grid. Without `columns`, uses `auto-fill, minmax(minColumn, 1fr)`. */
export function Grid(props: GridProps): JSX.Element {
  const [own, rest] = splitProps(props, ['minColumn', 'columns', 'gap', 'style', 'children']);
  const style = (): JSX.CSSProperties => ({
    display: 'grid',
    gap: space(own.gap ?? '4'),
    'grid-template-columns':
      own.columns !== undefined
        ? `repeat(${own.columns}, minmax(0, 1fr))`
        : `repeat(auto-fill, minmax(${own.minColumn ?? '240px'}, 1fr))`,
    ...((own.style as JSX.CSSProperties | undefined) ?? {}),
  });
  return (
    <div style={style()} {...rest}>
      {own.children}
    </div>
  );
}
