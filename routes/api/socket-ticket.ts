import { defineHandler } from "void";
import { createAuthLogic } from "../../src/logic/server/auth/createAuthLogic";
import { postSocketTicket } from "../../src/logic/server/http/sessionHandlers";

export const POST = defineHandler((c) => postSocketTicket(c, createAuthLogic(), new Date()));
