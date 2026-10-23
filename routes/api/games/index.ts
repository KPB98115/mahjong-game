import { defineHandler } from "void";
import { createAuthLogic } from "../../../src/logic/server/auth/createAuthLogic";
import { createGamesLogic } from "../../../src/logic/server/game/createGameLogic";
import { postGame } from "../../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) =>
  postGame(c, createAuthLogic(), createGamesLogic(), new Date()),
);
