import { defineHandler } from "void";
import { createAuthLogic } from "../../../../src/logic/server/auth/createAuthLogic";
import { createGamesLogic } from "../../../../src/logic/server/game/createGameLogic";
import { postAbortGame } from "../../../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) =>
  postAbortGame(c, c.req.param("gameId") ?? "", createAuthLogic(), createGamesLogic(), new Date()),
);
