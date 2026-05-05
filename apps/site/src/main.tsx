import { hydrate, render } from 'solid-js/web';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found in index.html');
}

// If the prerender pipeline filled the root with HTML, hydrate; otherwise
// fall back to client-side render (covers `vite dev` without prerender).
if (root.firstElementChild) {
  hydrate(() => <App url={window.location.pathname} />, root);
} else {
  render(() => <App url={window.location.pathname} />, root);
}
