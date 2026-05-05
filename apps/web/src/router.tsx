// Route definitions for the game client. Route map matches Phase 3 in
// `_todo/todobatch2.txt` exactly (15 routes). The router itself is mounted in
// `App.tsx`; this file only owns the JSX `<Route>` tree, the auth guard
// wiring, and the layout split between menu chrome and play chrome.

import { Route, type RouteSectionProps } from '@solidjs/router';
import { type Component, ErrorBoundary, type JSX } from 'solid-js';
import { MenuLayout } from './layouts/MenuLayout';
import { PlayLayout } from './layouts/PlayLayout';
import { Book } from './routes/Book';
import { CharacterCreate } from './routes/CharacterCreate';
import { CharacterList } from './routes/CharacterList';
import { Combat } from './routes/Combat';
import { Dialog } from './routes/Dialog';
import { Protected } from './routes/Guard';
import { Home } from './routes/Home';
import { Inventory } from './routes/Inventory';
import { Journal } from './routes/Journal';
import { Landing } from './routes/Landing';
import { LevelUp } from './routes/LevelUp';
import { LoadingScreen } from './routes/LoadingScreen';
import { Login } from './routes/Login';
import { Loot } from './routes/Loot';
import { Options } from './routes/Options';
import { Play } from './routes/Play';
import { RouteError } from './routes/RouteError';

/** Wraps a screen in an ErrorBoundary that renders the lore-flavored fallback. */
function withErrorBoundary(node: () => JSX.Element): Component<RouteSectionProps> {
  return () => (
    <ErrorBoundary fallback={(err, reset) => <RouteError error={err} reset={reset} />}>
      {node()}
    </ErrorBoundary>
  );
}

/** Same as above but also gates the route on the mock auth signal. */
function protectedScreen(node: () => JSX.Element): Component<RouteSectionProps> {
  return () => (
    <ErrorBoundary fallback={(err, reset) => <RouteError error={err} reset={reset} />}>
      <Protected>{node()}</Protected>
    </ErrorBoundary>
  );
}

/** Layout wrappers for the two route chrome variants. */
function MenuShell(props: RouteSectionProps): JSX.Element {
  return <MenuLayout>{props.children}</MenuLayout>;
}

function PlayShell(props: RouteSectionProps): JSX.Element {
  return (
    <Protected>
      <PlayLayout>{props.children}</PlayLayout>
    </Protected>
  );
}

function NotFound(): JSX.Element {
  return (
    <MenuLayout>
      <RouteError error={new Error('No path leads here.')} />
    </MenuLayout>
  );
}

/**
 * Route tree. The 15 paths from todobatch2.txt §Phase 3 split into three
 * groups by chrome: bare (`/`), menu (`/login`, `/home`, `/character*`,
 * `/loading/:variant`), and play (`/play*`).
 */
export function Routes(): JSX.Element {
  return (
    <>
      <Route path="/" component={withErrorBoundary(Landing)} />

      <Route component={MenuShell}>
        <Route path="/login" component={withErrorBoundary(Login)} />
        <Route path="/home" component={protectedScreen(Home)} />
        <Route path="/character" component={protectedScreen(CharacterList)} />
        <Route path="/character/create" component={protectedScreen(CharacterCreate)} />
        <Route path="/loading/:variant" component={withErrorBoundary(LoadingScreen)} />
      </Route>

      <Route component={PlayShell}>
        <Route path="/play" component={withErrorBoundary(Play)} />
        <Route path="/play/inventory" component={withErrorBoundary(Inventory)} />
        <Route path="/play/journal" component={withErrorBoundary(Journal)} />
        <Route path="/play/options" component={withErrorBoundary(Options)} />
        <Route path="/play/dialog/:npcId" component={withErrorBoundary(Dialog)} />
        <Route path="/play/loot/:lootId" component={withErrorBoundary(Loot)} />
        <Route path="/play/levelup" component={withErrorBoundary(LevelUp)} />
        <Route path="/play/book/:bookId" component={withErrorBoundary(Book)} />
        <Route path="/play/combat" component={withErrorBoundary(Combat)} />
      </Route>

      {/* Catch-all → return to safety. */}
      <Route path="*" component={NotFound} />
    </>
  );
}
