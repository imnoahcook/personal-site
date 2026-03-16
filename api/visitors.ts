import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { eq, sql, and } from 'drizzle-orm'

const ipHits = new Map<string, { count: number; resetAt: number }>()

function rateLimit(req: VercelRequest, res: VercelResponse, limit = 10, windowMs = 60_000): boolean {
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

const visitors = pgTable('visitors', {
  page: text('page').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

const visitedUids = pgTable('visited_uids', {
  uid: text('uid').notNull(),
  page: text('page').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.uid, table.page] }),
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    const page = (req.query.page ?? 'og') as string

    if (req.method === 'POST') {
      if (rateLimit(req, res, 10)) return

      const uid = getUid(req)

      if (uid) {
        const existing = await db
          .select()
          .from(visitedUids)
          .where(and(eq(visitedUids.uid, uid), eq(visitedUids.page, page)))
          .limit(1)

        if (existing.length > 0) {
          const result = await db.select().from(visitors).where(eq(visitors.page, page))
          res.json({ count: result[0]?.count ?? 0, already: true })
          return
        }

        await db
          .insert(visitedUids)
          .values({ uid, page })
          .onConflictDoNothing()
      }

      const result = await db
        .insert(visitors)
        .values({ page, count: 1 })
        .onConflictDoUpdate({
          target: visitors.page,
          set: {
            count: sql`${visitors.count} + 1`,
            updatedAt: sql`now()`,
          },
        })
        .returning()

      res.json({ count: result[0].count })
    } else {
      const result = await db.select().from(visitors).where(eq(visitors.page, page))
      res.json({ count: result[0]?.count ?? 0 })
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
