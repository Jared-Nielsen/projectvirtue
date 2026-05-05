// Tiny placeholder helper used by the Phase 3 route files. Phase 5 swaps each
// of these for the real screen component (see /docs/screen-mapping.md). The
// helper renders the route name, an optional mock-data preview, and an
// ErrorBoundary fallback hook for the parent route.

import { Card, Loading, Stack } from '@br/ui';
import { type JSX, Show, Suspense, createResource } from 'solid-js';

export interface PlaceholderProps {
  readonly title: string;
  readonly description?: string;
  /** A label for the mock-endpoint pill rendered next to the title. */
  readonly endpoint?: string;
  /** Async loader that proves the mock wiring works. */
  readonly load?: () => Promise<unknown>;
  /** Extra content rendered below the data preview. */
  readonly children?: JSX.Element;
}

export function Placeholder(props: PlaceholderProps): JSX.Element {
  const [data] = createResource(async () => {
    if (!props.load) return null;
    try {
      return await props.load();
    } catch (err) {
      return { error: (err as Error).message };
    }
  });

  return (
    <Card>
      <Stack gap="3">
        <Stack gap="1">
          <h1 style={{ margin: 0 }}>{props.title}</h1>
          <Show when={props.description}>
            <p style={{ margin: 0, opacity: 0.8 }}>{props.description}</p>
          </Show>
          <Show when={props.endpoint}>
            <code
              style={{
                'align-self': 'flex-start',
                padding: '2px 8px',
                'border-radius': '4px',
                'background-color': 'rgba(255,255,255,0.06)',
                'font-size': '0.85rem',
              }}
            >
              {props.endpoint}
            </code>
          </Show>
        </Stack>

        <Show when={props.load}>
          <Suspense fallback={<Loading label="Loading mock data…" />}>
            <Show when={data()}>
              {(d) => (
                <pre
                  style={{
                    margin: 0,
                    padding: 'var(--br-space-3, 0.75rem)',
                    'background-color': 'rgba(0,0,0,0.35)',
                    'border-radius': 'var(--br-radius-md, 6px)',
                    'max-height': '320px',
                    overflow: 'auto',
                    'font-size': '0.8rem',
                    'white-space': 'pre-wrap',
                  }}
                >
                  {JSON.stringify(d(), null, 2)}
                </pre>
              )}
            </Show>
          </Suspense>
        </Show>

        {props.children}
      </Stack>
    </Card>
  );
}
