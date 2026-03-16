import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core'
import { desc } from 'drizzle-orm'

import { containsBannedWord } from '../src/bannedWords.js'

const ipHits = new Map<string, { count: number; resetAt: number }>()

function rateLimit(req: VercelRequest, res: VercelResponse, limit = 5, windowMs = 60_000): boolean {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now > entry.resetAt) { ipHits.set(ip, { count: 1, resetAt: now + windowMs }); return false }
  entry.count++
  if (entry.count > limit) { res.status(429).json({ error: 'too many requests' }); return true }
  return false
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  country: text('country').notNull().default('US'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    if (req.method === 'POST') {
      if (rateLimit(req, res)) return

      const { author, message } = req.body
      if (!author || !message) {
        res.status(400).json({ error: 'author and message required' })
        return
      }

      if (containsBannedWord(String(author)) || containsBannedWord(String(message))) {
        res.status(403).json({ error: 'prohibited language' })
        return
      }

      const country = (req.headers['x-vercel-ip-country'] as string) ?? 'US'

      const result = await db
        .insert(posts)
        .values({
          author: stripTags(String(author)).slice(0, 50),
          message: stripTags(String(message)).slice(0, 500),
          country: country.slice(0, 2).toUpperCase(),
        })
        .returning()

      res.json(result[0])
    } else {
      const result = await db
        .select()
        .from(posts)
        .orderBy(desc(posts.createdAt))
        .limit(50)

      res.json(result)
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
