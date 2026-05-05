import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import { useMeta } from '../lib/seo';

export const NotFound: Component = () => {
  useMeta({
    title: 'Page Not Found',
    description: 'The page you are seeking has wandered off the road.',
    path: '/404',
  });
  return (
    <section class="section">
      <div class="container surface" style={{ 'text-align': 'center', padding: '40px' }}>
        <h1>You have wandered from the path.</h1>
        <p>The road you sought leads nowhere on the map of Sosaria.</p>
        <A href="/" class="cta cta--primary">
          Return Home
        </A>
      </div>
    </section>
  );
};
