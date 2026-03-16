import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, boolean, timestamp, serial } from 'drizzle-orm/pg-core'
import { desc, eq, sql } from 'drizzle-orm'

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

function getUid(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(/(?:^|; )uid=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  country: text('country').notNull().default('US'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  aliases: text('aliases').array().default([]),
  banned: boolean('banned').notNull().default(false),
  bannedAt: timestamp('banned_at'),
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

      const uid = getUid(req)

      if (uid) {
        const userRows = await db
          .select({ banned: users.banned })
          .from(users)
          .where(eq(users.uid, uid))
        if (userRows[0]?.banned) {
          res.status(403).json({ error: 'you are banned', banned: true })
          return
        }
      }

      const { author, message } = req.body
      if (!author || !message) {
        res.status(400).json({ error: 'author and message required' })
        return
      }

      if (containsBannedWord(String(author)) || containsBannedWord(String(message))) {
        if (uid) {
          await db
            .insert(users)
            .values({ uid, banned: true, bannedAt: new Date() })
            .onConflictDoUpdate({
              target: users.uid,
              set: { banned: true, bannedAt: new Date() },
            })
        }
        res.status(403).json({ error: 'prohibited language', banned: true })
        return
      }

      const cleanAuthor = stripTags(String(author)).slice(0, 50)
      const country = (req.headers['x-vercel-ip-country'] as string) ?? 'US'

      const result = await db
        .insert(posts)
        .values({
          author: cleanAuthor,
          message: stripTags(String(message)).slice(0, 500),
          country: country.slice(0, 2).toUpperCase(),
        })
        .returning()

      if (uid) {
        await db
          .insert(users)
          .values({ uid, aliases: [cleanAuthor] })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              aliases: sql`CASE
                WHEN ${cleanAuthor} = ANY(${users.aliases}) THEN ${users.aliases}
                ELSE array_append(${users.aliases}, ${cleanAuthor})
              END`,
            },
          })
      }

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
