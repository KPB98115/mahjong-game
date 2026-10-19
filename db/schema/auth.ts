import { boolean, pgSchema, text, uuid } from "void/schema-pg";
import { timestamptz, uuidPrimaryKey } from "./columns";
import { users } from "./profile";

export const authSchema = pgSchema("auth");

export const sessions = authSchema.table("sessions", {
  id: uuidPrimaryKey("id"),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.uuid),
  tokenHash: text("token_hash").notNull().unique(),
  isExpired: boolean("is_expired").notNull().default(false),
  createdAt: timestamptz("created_at"),
  updatedAt: timestamptz("updated_at"),
  lastSeenAt: timestamptz("last_seen_at"),
});
