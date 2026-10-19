import { index, numeric, pgSchema, text, unique, uuid } from "void/schema-pg";
import { timestamptz, uuidPrimaryKey } from "./columns";

export const profileSchema = pgSchema("profile");

export const users = profileSchema.table("users", {
  uuid: uuidPrimaryKey("uuid"),
  createdAt: timestamptz("created_at"),
  updatedAt: timestamptz("updated_at"),
});

export const userAttributes = profileSchema.table(
  "user_attributes",
  {
    id: uuidPrimaryKey("id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.uuid, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    unique("user_attributes_user_id_name_key").on(table.userId, table.name),
    index("user_attributes_user_id_idx").on(table.userId),
  ],
);

export const userFigures = profileSchema.table(
  "user_figures",
  {
    id: uuidPrimaryKey("id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.uuid, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: numeric("value").notNull(),
  },
  (table) => [
    unique("user_figures_user_id_name_key").on(table.userId, table.name),
    index("user_figures_user_id_idx").on(table.userId),
  ],
);
