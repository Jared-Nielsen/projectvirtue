// Client-side meta tag updater. Called by each page via useMeta() — applies
// document.title and the og:* / description meta tags imperatively. The
// initial values from index.html cover crawlers that don't run JS; subsequent
// route changes overwrite them for users that do.

import { onMount } from 'solid-js';
import { isServer } from 'solid-js/web';

export interface MetaProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
}

const SITE_NAME = 'Project Virtue';
const SITE_BASE = 'https://virtu3.com';

function applyMeta(props: MetaProps): void {
  if (isServer || typeof document === 'undefined') return;
  const fullTitle = `${props.title} — ${SITE_NAME}`;
  const canonical = `${SITE_BASE}${props.path}`;
  document.title = fullTitle;
  setMeta('name', 'description', props.description);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', props.description);
  setMeta('property', 'og:image', props.ogImage ?? '/og-image.svg');
  setMeta('property', 'og:url', canonical);
  setLink('canonical', canonical);
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Solid component-side helper. Updates head tags on mount. */
export function useMeta(props: MetaProps): void {
  if (!isServer) {
    onMount(() => applyMeta(props));
  }
}
