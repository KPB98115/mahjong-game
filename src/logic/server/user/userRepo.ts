import { userAttributes, userFigures, users } from "@schema";
import { eq } from "void/db";
import { executor, type DbExecutor } from "../db/executor";

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserAttributeRow = typeof userAttributes.$inferSelect;
export type UserFigureRow = typeof userFigures.$inferSelect;

export class UserRepo {
  async insert(values: NewUser = {}, tx?: DbExecutor): Promise<UserRow> {
    const [row] = await executor(tx).insert(users).values(values).returning();
    if (row === undefined) {
      throw new Error("insert user returned no row");
    }
    return row;
  }

  async findByUuid(uuid: string, tx?: DbExecutor): Promise<UserRow | undefined> {
    const [row] = await executor(tx).select().from(users).where(eq(users.uuid, uuid));
    return row;
  }

  async listAttributes(userId: string, tx?: DbExecutor): Promise<UserAttributeRow[]> {
    return executor(tx).select().from(userAttributes).where(eq(userAttributes.userId, userId));
  }

  async listFigures(userId: string, tx?: DbExecutor): Promise<UserFigureRow[]> {
    return executor(tx).select().from(userFigures).where(eq(userFigures.userId, userId));
  }

  async upsertAttribute(
    userId: string,
    name: string,
    value: string,
    tx?: DbExecutor,
  ): Promise<UserAttributeRow> {
    const [row] = await executor(tx)
      .insert(userAttributes)
      .values({ userId, name, value })
      .onConflictDoUpdate({
        target: [userAttributes.userId, userAttributes.name],
        set: { value },
      })
      .returning();
    if (row === undefined) {
      throw new Error("upsert attribute returned no row");
    }
    return row;
  }

  async upsertFigure(
    userId: string,
    name: string,
    value: string,
    tx?: DbExecutor,
  ): Promise<UserFigureRow> {
    const [row] = await executor(tx)
      .insert(userFigures)
      .values({ userId, name, value })
      .onConflictDoUpdate({
        target: [userFigures.userId, userFigures.name],
        set: { value },
      })
      .returning();
    if (row === undefined) {
      throw new Error("upsert figure returned no row");
    }
    return row;
  }
}
