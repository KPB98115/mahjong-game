import { defineHandler } from "void";

export const GET = defineHandler(() => {
  return {
    message: "Hello from Void",
    framework: "Vue",
    database: "PostgreSQL",
  };
});
