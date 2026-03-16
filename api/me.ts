import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, boolean, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { eq } from 'drizzle-orm'

function getUid(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(/(?:^|; )uid=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  aliases: text('aliases').array().default([]),
  banned: boolean('banned').notNull().default(false),
  bannedAt: timestamp('banned_at'),
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
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' })
    return
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const uid = getUid(req)
  if (!uid) {
    res.json({ banned: false, starred: [], aliases: [] })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    const userRows = await db
      .select({ banned: users.banned, aliases: users.aliases })
      .from(users)
      .where(eq(users.uid, uid))

    const starRows = await db
      .select({ postId: userStars.postId })
      .from(userStars)
      .where(eq(userStars.uid, uid))

    const user = userRows[0]
    res.json({
      banned: user?.banned ?? false,
      starred: starRows.map((r) => r.postId),
      aliases: user?.aliases ?? [],
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
