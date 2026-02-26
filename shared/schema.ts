import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const bracketContests = pgTable("bracket_contests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sponsor_id: varchar("sponsor_id"),
  status: text("status").notNull().default("open"),
  prize_pool_crowns: integer("prize_pool_crowns").notNull().default(0),
  max_entries: integer("max_entries"),
  lock_time: timestamp("lock_time", { withTimezone: true }),
  season: text("season"),
  year: integer("year"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const bracketTeams = pgTable("bracket_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bracket_contest_id: varchar("bracket_contest_id").notNull(),
  team_name: text("team_name").notNull(),
  seed: integer("seed").notNull(),
  region: text("region").notNull(),
  eliminated: boolean("eliminated").notNull().default(false),
  eliminated_round: integer("eliminated_round"),
});

export const bracketRounds = pgTable("bracket_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bracket_contest_id: varchar("bracket_contest_id").notNull(),
  round_number: integer("round_number").notNull(),
  status: text("status").notNull().default("pending"),
  points_per_correct_pick: integer("points_per_correct_pick").notNull().default(1),
});

export const bracketGames = pgTable("bracket_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bracket_contest_id: varchar("bracket_contest_id").notNull(),
  round_number: integer("round_number").notNull(),
  region: text("region"),
  team1_id: varchar("team1_id"),
  team2_id: varchar("team2_id"),
  winner_team_id: varchar("winner_team_id"),
  game_date: timestamp("game_date", { withTimezone: true }),
  balldontlie_game_id: integer("balldontlie_game_id"),
});

export const bracketPicks = pgTable("bracket_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull(),
  bracket_contest_id: varchar("bracket_contest_id").notNull(),
  team_id: varchar("team_id").notNull(),
  round_number: integer("round_number").notNull(),
  is_correct: boolean("is_correct"),
});

export const bracketEntries = pgTable("bracket_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull(),
  bracket_contest_id: varchar("bracket_contest_id").notNull(),
  total_score: integer("total_score").notNull().default(0),
  rank: integer("rank"),
  crowns_awarded: integer("crowns_awarded").notNull().default(0),
  submitted_at: timestamp("submitted_at", { withTimezone: true }).notNull().default(sql`now()`),
});
