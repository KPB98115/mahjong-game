import { pgTable, serial, text, timestamp } from "void/schema-pg";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export { authSchema, sessions } from "./schema/auth";
export {
  discardTiles,
  flowerTiles,
  gameSchema,
  games,
  hands,
  handTiles,
  melds,
  meldTiles,
  rounds,
  roundScores,
  scorePayments,
  seats,
  wallTiles,
} from "./schema/game";
export { profileSchema, userAttributes, userFigures, users } from "./schema/profile";
