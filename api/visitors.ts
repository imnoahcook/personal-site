import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { visitors } from '../src/db/schema'
import { eq, sql } from 'drizzle-orm'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  try {
    const page = (req.query.page ?? 'og') as string

    if (req.method === 'POST') {
      // Increment and return
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
      // Just read
      const result = await db.select().from(visitors).where(eq(visitors.page, page))
      res.json({ count: result[0]?.count ?? 0 })
    }
  } finally {
    await client.end()
  }
}
