// `/play/book/:bookId` — book reader placeholder (9-5-ReadBook.png).

import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Book(): JSX.Element {
  const params = useParams<{ bookId: string }>();
  return (
    <Placeholder
      title={`Book — ${params.bookId}`}
      description="Page-turn reader with lore citations."
      endpoint={`GET /v1/books/${params.bookId}`}
      load={() => mockClient.get(`/v1/books/${params.bookId}`)}
    />
  );
}
