export const devModeStorageKey = "mahjong-dev-mode";

export function storedDevMode(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(devModeStorageKey) === "on";
}

export function rememberDevMode(storage: Pick<Storage, "setItem">, enabled: boolean): void {
  storage.setItem(devModeStorageKey, enabled ? "on" : "off");
}

export class DevModeLogic {
  enabled = false;

  load(saved: boolean): void {
    this.enabled = saved;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
