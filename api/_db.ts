import { pgTable, text, integer, timestamp, serial } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export const visitors = pgTable('visitors', {
  page: text('page').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  country: text('country').notNull().default('US'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export function createDb() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  const db = drizzle(client)
  return { client, db }
}
