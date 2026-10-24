import { defineHandler, type InferProps } from "void";
import { createAuthLogic } from "../src/logic/server/auth/createAuthLogic";
import { staticGamePageOptions } from "../src/logic/server/http/pageOptions";
import { readSessionCookie } from "../src/logic/server/http/sessionCookie";
import { createUserLogic } from "../src/logic/server/user/createUserLogic";
import { isResolveSessionErr } from "../src/types/server/auth";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const resolved = await createAuthLogic().resolveSession({
    rawToken: readSessionCookie(c),
    createIfMissing: false,
    now: new Date(),
  });
  if (!isResolveSessionErr(resolved)) {
    const profile = await createUserLogic().loadProfile(resolved.userId);
    if (profile.currentGame != null) {
      return c.redirect(`/game/${profile.currentGame.gameId}`);
    }
  }
  return staticGamePageOptions();
});
