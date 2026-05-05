import { Route, Router } from '@solidjs/router';
import type { Component } from 'solid-js';
import { Layout } from './components/Layout';
import { About } from './pages/About';
import { Features } from './pages/Features';
import { Home } from './pages/Home';
import { Join } from './pages/Join';
import { Journal } from './pages/Journal';
import { JournalPost } from './pages/JournalPost';
import { Media } from './pages/Media';
import { NotFound } from './pages/NotFound';
import { Worlds } from './pages/Worlds';
import { WorldsMap } from './pages/WorldsMap';

export const App: Component = () => {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/features" component={Features} />
      <Route path="/worlds" component={Worlds} />
      <Route path="/worlds/map" component={WorldsMap} />
      <Route path="/journal" component={Journal} />
      <Route path="/journal/:slug" component={JournalPost} />
      <Route path="/media" component={Media} />
      <Route path="/join" component={Join} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
};
