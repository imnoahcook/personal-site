import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { posts } from '../src/db/schema'
import { desc } from 'drizzle-orm'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)

  try {
    if (req.method === 'POST') {
      const { author, message } = req.body
      if (!author || !message) {
        res.status(400).json({ error: 'author and message required' })
        return
      }

      const result = await db
        .insert(posts)
        .values({
          author: String(author).slice(0, 50),
          message: String(message).slice(0, 500),
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
  } finally {
    await client.end()
  }
}
