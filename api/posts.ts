import type { VercelRequest, VercelResponse } from '@vercel/node'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core'
import { desc } from 'drizzle-orm'

const BANNED_WORDS = [
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga', 'n1gg3r', 'nig', 'n1g',
  'faggot', 'fagg0t', 'f4ggot', 'f4gg0t', 'fag', 'f4g',
  'retard', 'r3tard', 'retrd',
  'tranny', 'tr4nny',
  'kike', 'k1ke',
  'chink', 'ch1nk',
  'spic', 'sp1c',
  'wetback', 'w3tback',
  'beaner', 'b3aner',
  'gook', 'g00k',
  'coon', 'c00n',
  'darkie', 'dark1e',
  'jigaboo', 'jiggaboo',
  'raghead', 'r4ghead',
  'towelhead',
  'zipperhead',
  'cracker', 'cr4cker',
  'honky', 'h0nky',
  'gringo', 'gr1ngo',
  'dyke', 'dyk3',
  'lesbo', 'l3sbo',
  'fuck', 'fck', 'fuk', 'f_ck', 'phuck', 'phuk',
  'shit', 'sh1t', 'sht', 'sh!t',
  'bitch', 'b1tch', 'b!tch',
  'cunt', 'c_nt',
  'dick', 'd1ck',
  'cock', 'c0ck',
  'pussy', 'puss1',
  'whore', 'wh0re', 'h0e', 'hoe',
  'slut', 'sl_t',
  'stfu', 'gtfo', 'kys',
  'nazi', 'n4zi', 'naz1',
  'hitler', 'h1tler',
]

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

function containsBannedWord(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[\s._\-*#!¢$@]+/g, '')
  return BANNED_WORDS.some((word) => {
    const normalizedWord = word.toLowerCase().replace(/[\s._\-*#!¢$@]+/g, '')
    return normalized.includes(normalizedWord)
  })
}

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false })
  const db = drizzle(client)

  try {
    if (req.method === 'POST') {
      const { author, message } = req.body
      if (!author || !message) {
        res.status(400).json({ error: 'author and message required' })
        return
      }

      if (containsBannedWord(String(author)) || containsBannedWord(String(message))) {
        res.status(403).json({ error: 'prohibited language' })
        return
      }

      const result = await db
        .insert(posts)
        .values({
          author: stripTags(String(author)).slice(0, 50),
          message: stripTags(String(message)).slice(0, 500),
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
  } catch (err) {
    res.status(500).json({ error: String(err) })
  } finally {
    await client.end()
  }
}
