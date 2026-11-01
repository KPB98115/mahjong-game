import { inject, type InjectionKey } from "vue";
import { type DevModeLogic } from "./devModeLogic";

export const devModeStateKey: InjectionKey<DevModeLogic> = Symbol("devMode");

export function useDevMode(): DevModeLogic {
  const devMode = inject(devModeStateKey);
  if (devMode == null) {
    throw new Error("DevModeLogic is not provided");
  }
  return devMode;
}
