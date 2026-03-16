import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp, serial, primaryKey } from 'drizzle-orm/pg-core'
import { eq, sql, and } from 'drizzle-orm'

const ipHits = new Map<string, { count: number; resetAt: number }>()

function rateLimit(req: VercelRequest, res: VercelResponse, limit = 20, windowMs = 60_000): boolean {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now > entry.resetAt) { ipHits.set(ip, { count: 1, resetAt: now + windowMs }); return false }
  entry.count++
  if (entry.count > limit) { res.status(429).json({ error: 'too many requests' }); return true }
  return false
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

const userStars = pgTable('user_stars', {
  uid: text('uid').notNull(),
  postId: integer('post_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.uid, table.postId] }),
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (rateLimit(req, res)) return

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    const uid = getUid(req)

    if (req.method === 'GET') {
      if (!uid) { res.json({ starred: [] }); return }
      const rows = await db
        .select({ postId: userStars.postId })
        .from(userStars)
        .where(eq(userStars.uid, uid))
      res.json({ starred: rows.map((r) => r.postId) })
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'GET or POST only' })
      return
    }

    if (!uid) {
      res.status(400).json({ error: 'uid cookie required' })
      return
    }

    const id = Number(req.query.id)
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'valid post id required' })
      return
    }

    const existing = await db
      .select()
      .from(userStars)
      .where(and(eq(userStars.uid, uid), eq(userStars.postId, id)))

    if (existing.length > 0) {
      await db
        .delete(userStars)
        .where(and(eq(userStars.uid, uid), eq(userStars.postId, id)))
      const result = await db
        .update(posts)
        .set({ stars: sql`GREATEST(${posts.stars} - 1, 0)` })
        .where(eq(posts.id, id))
        .returning()
      res.json({ stars: result[0]?.stars ?? 0, starred: false })
    } else {
      await db.insert(userStars).values({ uid, postId: id })
      const result = await db
        .update(posts)
        .set({ stars: sql`${posts.stars} + 1` })
        .where(eq(posts.id, id))
        .returning()
      if (result.length === 0) {
        res.status(404).json({ error: 'post not found' })
        return
      }
      res.json({ stars: result[0].stars, starred: true })
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
