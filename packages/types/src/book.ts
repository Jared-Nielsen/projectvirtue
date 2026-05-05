// Mirrors future protobuf message BookService; hand-written for now.

import type { BookId, Iso8601 } from './common';

export interface BookPage {
  readonly index: number;
  readonly heading?: string;
  readonly body: string;
  /** Optional illuminated initial / inline icon key. */
  readonly illustration?: string;
}

export interface Book {
  readonly id: BookId;
  readonly title: string;
  readonly author: string;
  readonly era: string;
  readonly summary: string;
  readonly pages: readonly BookPage[];
  readonly tags: readonly string[];
  readonly readable: boolean;
  readonly publishedAt?: Iso8601;
}

export interface CodexEntry {
  readonly id: string;
  readonly bookId?: BookId;
  readonly title: string;
  readonly category: 'lore' | 'history' | 'bestiary' | 'cartography' | 'arcana' | 'virtue';
  readonly excerpt: string;
  readonly discovered: boolean;
  readonly relatedQuests: readonly string[];
}
