import { messageCatalogs } from "./messages";
import { MessageKey } from "../../../types/client/messageKey";
import { Locale } from "../../../types/client/locale";
import { ApiError } from "../../../types/server/api";
import { BotDifficulty } from "../../../types/server/botDifficulty";
import { ClaimWindowMs } from "../../../types/server/claimWindowMs";
import { DiscardWinPayer } from "../../../types/server/discardWinPayer";
import { MeldType } from "../../../types/server/meldType";
import { RoundPhase } from "../../../types/server/roundPhase";
import { RoundResultType } from "../../../types/server/roundResultType";
import { Ruleset } from "../../../types/server/ruleset";
import { ScoreUnit } from "../../../types/server/scoreUnit";
import { SocketError } from "../../../types/server/socketError";

export const localeStorageKey = "mahjong-locale";

const botNames: Record<string, MessageKey> = {
  "Bot (low)": MessageKey.BotLowName,
  "Bot (medium)": MessageKey.BotMediumName,
  "Bot (smart)": MessageKey.BotSmartName,
};

const errorKeys: Record<string, MessageKey> = {
  [ApiError.Unauthorized]: MessageKey.ErrorUnauthorized,
  [ApiError.GameNotFound]: MessageKey.ErrorGameNotFound,
  [ApiError.AlreadySeated]: MessageKey.ErrorAlreadySeated,
  [ApiError.GameFull]: MessageKey.ErrorGameFull,
  [ApiError.GameNotWaiting]: MessageKey.ErrorGameNotWaiting,
  [ApiError.GameNotCompleted]: MessageKey.ErrorGameNotCompleted,
  [ApiError.NorthComplete]: MessageKey.ErrorNorthComplete,
  [ApiError.GameNotAbortable]: MessageKey.ErrorGameNotAbortable,
  [ApiError.InvalidBody]: MessageKey.ErrorInvalidBody,
  [ApiError.RulesetUnknown]: MessageKey.ErrorRulesetUnknown,
  [ApiError.InvalidClaimWindow]: MessageKey.ErrorInvalidClaimWindow,
  [ApiError.NotSeated]: MessageKey.ErrorNotSeated,
  [ApiError.RedisUnavailable]: MessageKey.ErrorRedisUnavailable,
  [SocketError.GameNotInProgress]: MessageKey.ErrorGameNotInProgress,
  [SocketError.NotYourTurn]: MessageKey.ErrorNotYourTurn,
  [SocketError.AutoDrawEnabled]: MessageKey.ErrorAutoDrawEnabled,
  [SocketError.InvalidTile]: MessageKey.ErrorInvalidTile,
  [SocketError.InvalidClaim]: MessageKey.ErrorInvalidClaim,
  [SocketError.NoClaimWindow]: MessageKey.ErrorNoClaimWindow,
  [SocketError.StaleGame]: MessageKey.ErrorStaleGame,
};

export function resolveLocale(saved: string | null): Locale {
  const matched = saved == null ? undefined : matchLocale(saved);
  return matched ?? Locale.ZhTw;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string>,
): string {
  let message = messageCatalogs[locale][key];
  if (values == null) {
    return message;
  }
  for (const name of Object.keys(values)) {
    message = message.split(`{${name}}`).join(values[name] ?? "");
  }
  return message;
}

export function rememberLocale(storage: Pick<Storage, "setItem">, locale: Locale): void {
  storage.setItem(localeStorageKey, locale);
}

export function storedLocale(storage: Pick<Storage, "getItem">): string | null {
  return storage.getItem(localeStorageKey);
}

export class LocaleLogic {
  locale: Locale = Locale.ZhTw;

  bootstrap(saved: string | null): void {
    this.locale = resolveLocale(saved);
  }

  choose(locale: Locale): void {
    this.locale = locale;
  }

  text(key: MessageKey, values?: Record<string, string>): string {
    return translate(this.locale, key, values);
  }

  errorLabel(error: string): string {
    const key = errorKeys[error];
    return key == null ? error : this.text(key);
  }

  playerLabel(displayName: string | null, seatIndex: number): string {
    if (displayName == null || displayName.length === 0) {
      return this.text(MessageKey.SeatFallback, { seat: String(seatIndex) });
    }
    const botKey = botNames[displayName];
    return botKey == null ? displayName : this.text(botKey);
  }

  claimWindowLabel(value: number | null): string {
    if (value == null) {
      return this.text(MessageKey.Unlimited);
    }
    if (value === ClaimWindowMs.FiveSeconds) {
      return this.text(MessageKey.FiveSeconds);
    }
    if (value === ClaimWindowMs.TenSeconds) {
      return this.text(MessageKey.TenSeconds);
    }
    return this.text(MessageKey.Milliseconds, { ms: String(value) });
  }

  rulesetLabel(ruleset: Ruleset): string {
    if (ruleset === Ruleset.HongKong) {
      return this.text(MessageKey.RulesetHongKong);
    }
    if (ruleset === Ruleset.Taiwan) {
      return this.text(MessageKey.RulesetTaiwan);
    }
    return ruleset;
  }

  scoreUnitLabel(unit: ScoreUnit | undefined): string {
    if (unit === ScoreUnit.Fan) {
      return this.text(MessageKey.ScoreFan);
    }
    if (unit === ScoreUnit.Tai) {
      return this.text(MessageKey.ScoreTai);
    }
    return this.text(MessageKey.Preset);
  }

  payerLabel(payer: DiscardWinPayer | undefined): string {
    if (payer === DiscardWinPayer.Discarder) {
      return this.text(MessageKey.PayerDiscarder);
    }
    if (payer === DiscardWinPayer.AllThree) {
      return this.text(MessageKey.PayerAllThree);
    }
    return this.text(MessageKey.Preset);
  }

  difficultyLabel(difficulty: BotDifficulty): string {
    if (difficulty === BotDifficulty.Low) {
      return this.text(MessageKey.BotLow);
    }
    if (difficulty === BotDifficulty.Medium) {
      return this.text(MessageKey.BotMedium);
    }
    if (difficulty === BotDifficulty.Smart) {
      return this.text(MessageKey.BotSmart);
    }
    return difficulty;
  }

  phaseLabel(phase: string): string {
    if (phase === RoundPhase.Draw) {
      return this.text(MessageKey.PhaseDraw);
    }
    if (phase === RoundPhase.Discard) {
      return this.text(MessageKey.PhaseDiscard);
    }
    if (phase === RoundPhase.Claim) {
      return this.text(MessageKey.PhaseClaim);
    }
    if (phase === RoundPhase.RobKong) {
      return this.text(MessageKey.PhaseRobKong);
    }
    return phase;
  }

  resultLabel(result: string | null): string {
    if (result === RoundResultType.Win) {
      return this.text(MessageKey.ResultWin);
    }
    if (result === RoundResultType.Draw) {
      return this.text(MessageKey.ResultDraw);
    }
    if (result === RoundResultType.Abort) {
      return this.text(MessageKey.ResultAbort);
    }
    if (result == null) {
      return this.text(MessageKey.ResultComplete);
    }
    return result;
  }

  meldLabel(kind: string): string {
    if (kind === MeldType.Chow) {
      return this.text(MessageKey.Chow);
    }
    if (kind === MeldType.Pong) {
      return this.text(MessageKey.Pong);
    }
    if (kind === MeldType.Kong) {
      return this.text(MessageKey.Kong);
    }
    return kind;
  }

  boolLabel(value: boolean): string {
    return this.text(value ? MessageKey.On : MessageKey.Off);
  }
}

function matchLocale(value: string): Locale | undefined {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "zh-tw" ||
    normalized === "zh-hant" ||
    normalized === "zh-hk" ||
    normalized === "zh"
  ) {
    return Locale.ZhTw;
  }
  if (normalized === "en-us" || normalized === "en" || normalized.startsWith("en-")) {
    return Locale.EnUs;
  }
  return undefined;
}
