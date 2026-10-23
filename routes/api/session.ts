import { defineHandler } from "void";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { postSession } from "../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) => postSession(c, createAuthLogic(), new Date()));
