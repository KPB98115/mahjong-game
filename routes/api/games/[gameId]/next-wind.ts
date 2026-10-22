import { defineHandler } from "void";
import { createAuthLogic } from "../../../../src/logic/server/auth/createAuthLogic";
import { createGamesLogic } from "../../../../src/logic/server/game/createGameLogic";
import { postNextWind } from "../../../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) =>
  postNextWind(c, c.req.param("gameId") ?? "", createAuthLogic(), createGamesLogic(), new Date()),
);
