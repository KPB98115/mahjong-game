import { customType } from "void/schema-pg";

type StringEnum = Record<string, string>;

function toSqlText(value: string): string {
  let sqlText = "";
  for (const character of value) {
    if (character >= "A" && character <= "Z") {
      sqlText += "_";
      sqlText += character.toLowerCase();
    } else {
      sqlText += character;
    }
  }
  return sqlText;
}

function isEnumMember<T extends StringEnum>(enumObject: T, value: string): value is T[keyof T] {
  return Object.values(enumObject).includes(value);
}

export function sqlTextEnum<T extends StringEnum>(enumObject: T) {
  const toSql = new Map<T[keyof T], string>();
  const fromSql = new Map<string, T[keyof T]>();

  for (const value of Object.values(enumObject)) {
    if (!isEnumMember(enumObject, value)) {
      continue;
    }
    const sqlText = toSqlText(value);
    toSql.set(value, sqlText);
    fromSql.set(sqlText, value);
  }

  return customType<{ data: T[keyof T]; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(value) {
      const sqlText = toSql.get(value);
      if (sqlText === undefined) {
        throw new Error(`Unknown enum value for SQL text column: ${String(value)}`);
      }
      return sqlText;
    },
    fromDriver(value) {
      const enumValue = fromSql.get(value);
      if (enumValue === undefined) {
        throw new Error(`Unknown SQL text for enum column: ${value}`);
      }
      return enumValue;
    },
  });
}
