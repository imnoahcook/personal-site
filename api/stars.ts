import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { posts } from '../src/db/schema'
import { eq, sql } from 'drizzle-orm'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
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
  } finally {
    await client.end()
  }
}
