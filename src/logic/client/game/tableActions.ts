import { type InjectionKey } from "vue";

export type TableActions = {
  abort: (() => void) | null;
  pending: boolean;
};

export const tableActionsKey: InjectionKey<TableActions> = Symbol("tableActions");
