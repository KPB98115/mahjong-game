import { timestamp, uuid } from "void/schema-pg";

export function uuidPrimaryKey(columnName: string) {
  return uuid(columnName).primaryKey().defaultRandom();
}

export function timestamptz(columnName: string) {
  return timestamp(columnName, { withTimezone: true }).notNull().defaultNow();
}
