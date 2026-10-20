import { UserLogic } from "./userLogic";
import { UserRepo } from "./userRepo";

export function createUserLogic(): UserLogic {
  return new UserLogic(new UserRepo());
}
