import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { eq, sql } from 'drizzle-orm'

const visitors = pgTable('visitors', {
  page: text('page').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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
