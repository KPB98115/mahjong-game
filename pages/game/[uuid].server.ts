import { defineHandler, type InferProps } from "void";
import { env } from "void/env";
import { staticGamePageOptions } from "../../src/logic/server/http/pageOptions";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => {
  return {
    uuid: c.req.param("uuid") ?? "",
    socketOrigin: env.SOCKET_ORIGIN,
    ...staticGamePageOptions(),
  };
});
