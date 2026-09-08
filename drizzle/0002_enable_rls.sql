-- Enable Row-Level Security on every public table. No policies are added on
-- purpose: the app reaches Postgres only through the server-side API as the
-- `postgres` role (which bypasses RLS), so the anon/authenticated PostgREST
-- roles get no access at all.
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visited_uids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_stars" ENABLE ROW LEVEL SECURITY;
