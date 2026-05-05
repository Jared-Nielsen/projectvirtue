import { defineCollection, z } from 'astro:content';

// Journal posts collection. Schema mirrors the original `JournalPost` shape
// from src/data/journal-posts.ts; bodies are now Markdown rendered via
// Astro's content collection pipeline.
const journal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    date: z.string(),
    author: z.string(),
    tags: z.array(z.string()),
    category: z.enum(['dev-update', 'lore', 'tutorial', 'community']),
  }),
});

export const collections = { journal };
