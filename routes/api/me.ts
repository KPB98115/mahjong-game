import { defineHandler } from "void";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { getMe, patchMe } from "../../src/logic/server/http/sessionHandlers";
import { createUserLogic } from "../../src/logic/server/user/createUserLogic";

export const GET = defineHandler((c) => getMe(c, createAuthLogic(), createUserLogic(), new Date()));

export const PATCH = defineHandler((c) =>
  patchMe(c, createAuthLogic(), createUserLogic(), new Date()),
);
