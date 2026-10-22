import { defineHandler } from "void";
import { createAuthLogic } from "../../../src/logic/server/auth/createAuthLogic";
import { createSeatsLogic } from "../../../src/logic/server/game/createGameLogic";
import { postJoinGame } from "../../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) =>
  postJoinGame(c, createAuthLogic(), createSeatsLogic(), new Date()),
);
