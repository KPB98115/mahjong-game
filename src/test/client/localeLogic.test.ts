import { describe, expect, it } from "vitest";
import { LocaleLogic, resolveLocale, translate } from "../../logic/client/locale/localeLogic";
import { Locale } from "../../types/client/locale";
import { MessageKey } from "../../types/client/messageKey";

describe("resolveLocale", () => {
  it("defaults to zh-TW when nothing was saved", () => {
    expect(resolveLocale(null)).toBe(Locale.ZhTw);
  });

  it("maps traditional Chinese tags to zh-TW and English tags to en-US", () => {
    expect(resolveLocale("zh-TW")).toBe(Locale.ZhTw);
    expect(resolveLocale("zh-Hant")).toBe(Locale.ZhTw);
    expect(resolveLocale("zh-HK")).toBe(Locale.ZhTw);
    expect(resolveLocale("zh")).toBe(Locale.ZhTw);
    expect(resolveLocale("en-US")).toBe(Locale.EnUs);
    expect(resolveLocale("en")).toBe(Locale.EnUs);
    expect(resolveLocale("en-GB")).toBe(Locale.EnUs);
  });

  it("falls back to zh-TW for an unsupported tag", () => {
    expect(resolveLocale("fr-FR")).toBe(Locale.ZhTw);
    expect(resolveLocale("  ")).toBe(Locale.ZhTw);
  });
});

describe("translate", () => {
  it("has a non-empty string for every key in both locales", () => {
    for (const key of Object.values(MessageKey)) {
      expect(translate(Locale.ZhTw, key).length).toBeGreaterThan(0);
      expect(translate(Locale.EnUs, key).length).toBeGreaterThan(0);
    }
  });

  it("fills placeholders without a regular expression", () => {
    expect(translate(Locale.ZhTw, MessageKey.EmptySeat, { seat: "2" })).toBe("空位 2");
    expect(translate(Locale.EnUs, MessageKey.EmptySeat, { seat: "2" })).toBe("Empty seat 2");
  });
});

describe("LocaleLogic", () => {
  it("starts in zh-TW and switches when the player chooses en-US", () => {
    const locale = new LocaleLogic();
    expect(locale.text(MessageKey.AppTitle)).toBe("麻將");
    locale.choose(Locale.EnUs);
    expect(locale.locale).toBe(Locale.EnUs);
    expect(locale.text(MessageKey.AppTitle)).toBe("Mahjong");
  });

  it("restores a saved locale and keeps zh-TW when the saved value is unknown", () => {
    const locale = new LocaleLogic();
    locale.bootstrap("en");
    expect(locale.locale).toBe(Locale.EnUs);
    locale.bootstrap("jp");
    expect(locale.locale).toBe(Locale.ZhTw);
  });

  it("translates known table labels and leaves an unknown error code visible", () => {
    const locale = new LocaleLogic();
    expect(locale.errorLabel("invalidBody")).toBe("資料不正確");
    expect(locale.errorLabel("nope")).toBe("nope");
    expect(locale.playerLabel("Bot (smart)", 3)).toBe("電腦（高）");
    expect(locale.playerLabel("Ada", 1)).toBe("Ada");
    expect(locale.playerLabel(null, 2)).toBe("座位 2");
    expect(locale.claimWindowLabel(null)).toBe("不限時");
    expect(locale.claimWindowLabel(5000)).toBe("5 秒");
    locale.choose(Locale.EnUs);
    expect(locale.playerLabel("Bot (low)", 0)).toBe("Bot (low)");
    expect(locale.claimWindowLabel(10000)).toBe("10 seconds");
  });
});
