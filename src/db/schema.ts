import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const visitors = pgTable('visitors', {
  page: text('page').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const visitedUids = pgTable(
  'visited_uids',
  {
    uid: text('uid').notNull(),
    page: text('page').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.uid, table.page] })],
)

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  stars: integer('stars').notNull().default(0),
  country: text('country').notNull().default('US'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  aliases: text('aliases').array().default([]),
  banned: boolean('banned').notNull().default(false),
  bannedAt: timestamp('banned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userStars = pgTable(
  'user_stars',
  {
    uid: text('uid').notNull(),
    postId: integer('post_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.uid, table.postId] })],
)
