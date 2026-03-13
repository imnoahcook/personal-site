import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core'
import { eq, sql } from 'drizzle-orm'

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    const id = Number(req.query.id)
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'valid post id required' })
      return
    }

    const result = await db
      .update(posts)
      .set({ stars: sql`${posts.stars} + 1` })
      .where(eq(posts.id, id))
      .returning()

    if (result.length === 0) {
      res.status(404).json({ error: 'post not found' })
      return
    }

    res.json({ stars: result[0].stars })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
