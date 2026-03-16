import type { VercelRequest, VercelResponse } from '@vercel/node'
import postgres from 'postgres'

function getUid(req: VercelRequest): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.match(/(?:^|; )uid=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function ensureTables(client: postgres.Sql) {
  await client`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      aliases TEXT[] DEFAULT '{}',
      banned BOOLEAN DEFAULT FALSE,
      banned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `
  await client`
    CREATE TABLE IF NOT EXISTS user_stars (
      uid TEXT NOT NULL,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      PRIMARY KEY (uid, post_id)
    )
  `
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

  try {
    await ensureTables(client)

    const [user] = await client`
      SELECT banned, aliases FROM users WHERE uid = ${uid}
    `
    const stars = await client`
      SELECT post_id FROM user_stars WHERE uid = ${uid}
    `

    res.json({
      banned: user?.banned ?? false,
      starred: stars.map((r) => r.post_id),
      aliases: user?.aliases ?? [],
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
