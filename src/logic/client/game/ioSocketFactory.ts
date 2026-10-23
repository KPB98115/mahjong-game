import { io } from "socket.io-client";
import { jsonValueSchema } from "../../../model/server/jsonValue";
import { type JsonValue } from "../../../types/server/jsonValue";
import { type ClientSocket, type SocketFactory } from "./socketLogic";

export const ioSocketFactory: SocketFactory = function ioSocketFactory(origin, options) {
  const socket = io(origin, {
    auth: options.auth,
    transports: ["websocket"],
  });
  const client: ClientSocket = {
    emit(event, payload) {
      socket.emit(event, payload);
    },
    on(event, listener) {
      socket.on(event, (payload: JsonValue) => {
        const parsed = jsonValueSchema.safeParse(payload);
        if (parsed.success) {
          listener(parsed.data);
        }
      });
    },
    disconnect() {
      socket.disconnect();
    },
  };
  return client;
};
