import { describe, expect, it } from "vitest";
import { parseApiEnvelope } from "../../model/server/envelope";
import { ApiError, ApiStatus } from "../../types/server/api";

describe("parseApiEnvelope", () => {
  it("parses a success envelope and keeps data as json", () => {
    const parsed = parseApiEnvelope({ status: ApiStatus.Success, data: { userId: "user-1" } });
    expect(parsed).toEqual({
      ok: true,
      data: { userId: "user-1" },
    });
  });

  it("parses a failed envelope with an ApiError enum string", () => {
    const parsed = parseApiEnvelope({ status: ApiStatus.Failed, error: ApiError.Unauthorized });
    expect(parsed).toEqual({
      ok: false,
      error: ApiError.Unauthorized,
    });
  });

  it("rejects missing data, unknown error strings, and non-objects", () => {
    expect(parseApiEnvelope({ status: ApiStatus.Success })).toBeUndefined();
    expect(parseApiEnvelope({ status: ApiStatus.Failed, error: "nope" })).toBeUndefined();
    expect(parseApiEnvelope("failed")).toBeUndefined();
    expect(parseApiEnvelope(null)).toBeUndefined();
  });
});
