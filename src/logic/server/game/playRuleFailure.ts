import { type SocketError } from "../../../types/server/socketError";

export class PlayRuleFailure extends Error {
  constructor(readonly error: SocketError) {
    super(error);
    this.name = "PlayRuleFailure";
  }
}

export function failPlay(error: SocketError): never {
  throw new PlayRuleFailure(error);
}

export function readPlayRuleFailure(error: object): SocketError | undefined {
  if (error instanceof PlayRuleFailure) {
    return error.error;
  }
  return undefined;
}
