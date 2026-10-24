import {
  createGameWireBody,
  emptyCreateGameViewModel,
  parsedCreateGameBody,
  type CreateGameDefaults,
  type CreateGameViewModel,
} from "../../../model/client/createGameViewModel";
import {
  emptyJoinGameViewModel,
  isJoinCode,
  type JoinGameViewModel,
} from "../../../model/client/joinGameViewModel";
import { type PlayerProfileModel } from "../../../model/client/playerProfileModel";
import {
  emptyRegisterViewModel,
  type RegisterViewModel,
} from "../../../model/client/registerViewModel";
import { ApiError } from "../../../types/server/api";
import { type PageNavigator } from "../../../types/client/pageNavigator";
import { type AuthLogic } from "../auth/authLogic";
import { type GamesLogic } from "../game/gamesLogic";

export class RegisterLogic {
  profile: PlayerProfileModel | null = null;
  register: RegisterViewModel = emptyRegisterViewModel();
  createGame: CreateGameViewModel;
  joinGame: JoinGameViewModel = emptyJoinGameViewModel();

  constructor(
    readonly auth: AuthLogic,
    readonly games: GamesLogic,
    readonly navigator: PageNavigator,
    defaults: CreateGameDefaults,
  ) {
    this.createGame = emptyCreateGameViewModel(defaults);
  }

  get hasDisplayName(): boolean {
    return this.profile?.displayName != null && this.profile.displayName.length > 0;
  }

  async bootstrap(): Promise<void> {
    this.register.error = undefined;
    const session = await this.auth.ensureSession();
    if (!session.ok) {
      this.register.error = session.error;
      return;
    }
    const profile = await this.auth.loadProfile();
    if (!profile.ok) {
      this.register.error = profile.error;
      return;
    }
    this.profile = profile.data;
    this.register.displayName = profile.data.displayName ?? "";
    if (profile.data.currentGame != null) {
      this.navigator.visit(`/game/${profile.data.currentGame.gameId}`);
    }
  }

  async saveDisplayName(): Promise<void> {
    this.register.error = undefined;
    this.register.pending = true;
    const result = await this.auth.saveDisplayName(this.register.displayName);
    this.register.pending = false;
    if (!result.ok) {
      this.register.error = result.error;
      return;
    }
    this.profile = result.data;
    this.register.displayName = result.data.displayName ?? "";
  }

  async create(): Promise<void> {
    this.register.error = undefined;
    if (!this.hasDisplayName) {
      this.register.error = ApiError.InvalidBody;
      return;
    }
    const parsed = parsedCreateGameBody(this.createGame);
    if (!parsed.ok) {
      this.register.error = parsed.error;
      return;
    }
    this.register.pending = true;
    const result = await this.games.create(createGameWireBody(this.createGame));
    this.register.pending = false;
    if (!result.ok) {
      this.register.error = result.error;
      return;
    }
    this.navigator.visit(`/game/${result.data.game.id}`);
  }

  async join(): Promise<void> {
    this.register.error = undefined;
    this.joinGame.error = undefined;
    if (!this.hasDisplayName) {
      this.register.error = ApiError.InvalidBody;
      return;
    }
    if (!isJoinCode(this.joinGame.referenceCode)) {
      this.joinGame.error = ApiError.InvalidBody;
      return;
    }
    this.register.pending = true;
    const result = await this.games.join(this.joinGame.referenceCode);
    this.register.pending = false;
    if (!result.ok) {
      this.joinGame.error = result.error;
      return;
    }
    this.navigator.visit(`/game/${result.data.game.id}`);
  }
}
