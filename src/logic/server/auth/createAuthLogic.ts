import { runTransaction } from "../db/executor";
import { SeatsRepo } from "../game/seatsRepo";
import { deleteCachedSession, getCachedSession, setCachedSession } from "../redis/sessionCache";
import { setSocketTicket } from "../redis/socketTicket";
import { UserRepo } from "../user/userRepo";
import { AuthLogic } from "./authLogic";
import { AuthRepo } from "./authRepo";

export function createAuthLogic(): AuthLogic {
  return new AuthLogic(
    new AuthRepo(),
    new UserRepo(),
    new SeatsRepo(),
    {
      getSession: getCachedSession,
      setSession: setCachedSession,
      deleteSession: deleteCachedSession,
      setSocketTicket,
    },
    runTransaction,
  );
}
