import { defineHandler } from "void";
import { createAuthLogic } from "../../../../src/logic/server/auth/createAuthLogic";
import { createSeatsLogic } from "../../../../src/logic/server/game/createGameLogic";
import { postAddBot } from "../../../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) =>
  postAddBot(c, c.req.param("gameId") ?? "", createAuthLogic(), createSeatsLogic(), new Date()),
);
