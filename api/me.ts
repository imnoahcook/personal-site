import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { userStars, users } from '../src/db/schema.js'

function getUid(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(/(?:^|; )uid=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

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
