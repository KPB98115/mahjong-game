import { defineHandler } from "void";
import { createAuthLogic } from "../../../src/logic/server/auth/createAuthLogic";
import { createGamesLogic } from "../../../src/logic/server/game/createGameLogic";
import { getGame } from "../../../src/logic/server/http/sessionHandlers";

export const GET = defineHandler((c) =>
  getGame(c, c.req.param("gameId") ?? "", createAuthLogic(), createGamesLogic(), new Date()),
);
