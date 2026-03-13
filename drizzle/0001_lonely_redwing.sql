CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"message" text NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
