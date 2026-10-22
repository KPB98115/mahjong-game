type PostgresErrorFields = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  cause?: PostgresErrorFields;
};

export function uniqueConstraintName(error: object): string | undefined {
  const seen = new Set<object>();
  let current: object | undefined = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (!isPostgresErrorFields(current)) {
      return undefined;
    }
    if (current.code === "23505") {
      if (current.constraint != null) {
        return current.constraint;
      }
      if (current.constraint_name != null) {
        return current.constraint_name;
      }
      return "";
    }
    const cause: PostgresErrorFields | undefined = current.cause;
    if (cause == null) {
      return undefined;
    }
    current = cause;
  }
  return undefined;
}

function isPostgresErrorFields(value: object): value is PostgresErrorFields {
  return "code" in value || "constraint" in value || "constraint_name" in value || "cause" in value;
}
