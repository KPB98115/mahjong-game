import { inject, type InjectionKey } from "vue";
import { type LocaleLogic } from "./localeLogic";

export const localeStateKey: InjectionKey<LocaleLogic> = Symbol("locale");

export function useLocale(): LocaleLogic {
  const locale = inject(localeStateKey);
  if (locale == null) {
    throw new Error("LocaleLogic is not provided");
  }
  return locale;
}
