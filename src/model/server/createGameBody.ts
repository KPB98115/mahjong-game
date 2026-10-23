import { z } from "zod";
import { ApiError } from "../../types/server/api";
import { type JsonRecord, type JsonValue } from "../../types/server/jsonValue";
import { ClaimWindowMs } from "../../types/server/claimWindowMs";
import { DiscardWinPayer } from "../../types/server/discardWinPayer";
import { Ruleset } from "../../types/server/ruleset";
import { ScoreUnit } from "../../types/server/scoreUnit";

const allowedKeys = [
  "ruleset",
  "scoreUnit",
  "discardWinPayer",
  "claimWindowMs",
  "autoDraw",
  "bonusTilesEnabled",
  "chowOnlyFromPrevious",
  "handTileCount",
  "winMeldCount",
  "minScoreUnits",
];

const claimWindowSchema = z.union([
  z.literal(ClaimWindowMs.FiveSeconds),
  z.literal(ClaimWindowMs.TenSeconds),
  z.null(),
]);

export const createGameBodySchema = z.object({
  ruleset: z.enum(Ruleset),
  scoreUnit: z.enum(ScoreUnit).optional(),
  discardWinPayer: z.enum(DiscardWinPayer).optional(),
  claimWindowMs: claimWindowSchema.optional(),
  autoDraw: z.boolean().optional(),
  bonusTilesEnabled: z.boolean().optional(),
  chowOnlyFromPrevious: z.boolean().optional(),
  handTileCount: z.number().optional(),
  winMeldCount: z.number().optional(),
  minScoreUnits: z.number().optional(),
});

export type CreateGameBody = z.infer<typeof createGameBodySchema>;

const createGameOkSchema = z.object({
  ok: z.literal(true),
  body: createGameBodySchema,
});

const createGameErrSchema = z.object({
  ok: z.literal(false),
  error: z.union([
    z.literal(ApiError.InvalidBody),
    z.literal(ApiError.RulesetUnknown),
    z.literal(ApiError.InvalidClaimWindow),
  ]),
});

export type CreateGameParseResult =
  | z.infer<typeof createGameOkSchema>
  | z.infer<typeof createGameErrSchema>;

export function parseCreateGameBody(input: JsonValue): CreateGameParseResult {
  if (!isRecord(input)) {
    return createGameErrSchema.parse({ ok: false, error: ApiError.InvalidBody });
  }
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      return createGameErrSchema.parse({ ok: false, error: ApiError.InvalidBody });
    }
  }
  const ruleset = z.enum(Ruleset).safeParse(input.ruleset);
  if (!ruleset.success) {
    return createGameErrSchema.parse({ ok: false, error: ApiError.RulesetUnknown });
  }
  if ("claimWindowMs" in input && !claimWindowSchema.safeParse(input.claimWindowMs).success) {
    return createGameErrSchema.parse({ ok: false, error: ApiError.InvalidClaimWindow });
  }
  const scoreUnit = readEnum(input, "scoreUnit", z.enum(ScoreUnit));
  const discardWinPayer = readEnum(input, "discardWinPayer", z.enum(DiscardWinPayer));
  const autoDraw = readBoolean(input, "autoDraw");
  const bonusTilesEnabled = readBoolean(input, "bonusTilesEnabled");
  const chowOnlyFromPrevious = readBoolean(input, "chowOnlyFromPrevious");
  const handTileCount = readNumber(input, "handTileCount");
  const winMeldCount = readNumber(input, "winMeldCount");
  const minScoreUnits = readNumber(input, "minScoreUnits");
  if (
    scoreUnit === "invalid" ||
    discardWinPayer === "invalid" ||
    autoDraw === "invalid" ||
    bonusTilesEnabled === "invalid" ||
    chowOnlyFromPrevious === "invalid" ||
    handTileCount === "invalid" ||
    winMeldCount === "invalid" ||
    minScoreUnits === "invalid"
  ) {
    return createGameErrSchema.parse({ ok: false, error: ApiError.InvalidBody });
  }
  const claimWindow = claimWindowSchema.safeParse(
    "claimWindowMs" in input ? input.claimWindowMs : undefined,
  );
  return createGameOkSchema.parse({
    ok: true,
    body: {
      ruleset: ruleset.data,
      scoreUnit: scoreUnit === "absent" ? undefined : scoreUnit,
      discardWinPayer: discardWinPayer === "absent" ? undefined : discardWinPayer,
      claimWindowMs: "claimWindowMs" in input && claimWindow.success ? claimWindow.data : undefined,
      autoDraw: autoDraw === "absent" ? undefined : autoDraw,
      bonusTilesEnabled: bonusTilesEnabled === "absent" ? undefined : bonusTilesEnabled,
      chowOnlyFromPrevious: chowOnlyFromPrevious === "absent" ? undefined : chowOnlyFromPrevious,
      handTileCount: handTileCount === "absent" ? undefined : handTileCount,
      winMeldCount: winMeldCount === "absent" ? undefined : winMeldCount,
      minScoreUnits: minScoreUnits === "absent" ? undefined : minScoreUnits,
    },
  });
}

function isRecord(input: JsonValue): input is JsonRecord {
  return typeof input === "object" && input != null && !Array.isArray(input);
}

function readEnum<T extends z.ZodType>(
  record: JsonRecord,
  key: string,
  schema: T,
): z.output<T> | "absent" | "invalid" {
  if (!(key in record)) {
    return "absent";
  }
  const parsed = schema.safeParse(record[key]);
  if (!parsed.success) {
    return "invalid";
  }
  return parsed.data;
}

function readBoolean(record: JsonRecord, key: string): boolean | "absent" | "invalid" {
  return readEnum(record, key, z.boolean());
}

function readNumber(record: JsonRecord, key: string): number | "absent" | "invalid" {
  return readEnum(record, key, z.number());
}
