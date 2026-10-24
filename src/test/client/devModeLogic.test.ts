import { describe, expect, it } from "vitest";
import {
  DevModeLogic,
  rememberDevMode,
  storedDevMode,
} from "../../logic/client/dev/devModeLogic";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("dev mode storage", () => {
  it("stays off until the player turns it on", () => {
    const storage = memoryStorage();
    expect(storedDevMode(storage)).toBe(false);
    rememberDevMode(storage, true);
    expect(storedDevMode(storage)).toBe(true);
    rememberDevMode(storage, false);
    expect(storedDevMode(storage)).toBe(false);
  });

  it("toggles the in-memory flag and returns the next value", () => {
    const logic = new DevModeLogic();
    expect(logic.enabled).toBe(false);
    expect(logic.toggle()).toBe(true);
    expect(logic.enabled).toBe(true);
    logic.load(false);
    expect(logic.enabled).toBe(false);
  });
});
