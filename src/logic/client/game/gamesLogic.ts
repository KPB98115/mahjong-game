import { type BotDifficulty } from "../../../types/server/botDifficulty";
import {
  abortGameResponseSchema,
  type AbortGameResponse,
} from "../../../model/server/actionResult";
import { addBotBodySchema } from "../../../model/server/addBotBody";
import { parseCreateGameBody } from "../../../model/server/createGameBody";
import { gameSnapshotSchema, type GameSnapshot } from "../../../model/server/gameSnapshot";
import { joinGameBodySchema } from "../../../model/server/joinGameBody";
import { ApiError, HttpStatus } from "../../../types/server/api";
import { type JsonValue } from "../../../types/server/jsonValue";
import { type ApiClient, type ApiErr, type ApiResult } from "../http/apiClient";

export class GamesLogic {
  constructor(readonly api: ApiClient) {}

  async create(body: JsonValue): Promise<ApiResult<GameSnapshot>> {
    const parsed = parseCreateGameBody(body);
    if (!parsed.ok) {
      return bodyError(parsed.error);
    }
    return this.api.post("/api/games", parsed.body, gameSnapshotSchema);
  }

  async join(referenceCode: string): Promise<ApiResult<GameSnapshot>> {
    const parsed = joinGameBodySchema.safeParse({ referenceCode });
    if (!parsed.success) {
      return bodyError(ApiError.InvalidBody);
    }
    return this.api.post("/api/games/join", parsed.data, gameSnapshotSchema);
  }

  async loadSnapshot(gameId: string): Promise<ApiResult<GameSnapshot>> {
    return this.api.get(`/api/games/${gameId}`, gameSnapshotSchema);
  }

  async abort(gameId: string): Promise<ApiResult<AbortGameResponse>> {
    return this.api.post(`/api/games/${gameId}/abort`, undefined, abortGameResponseSchema);
  }

  async addBot(gameId: string, difficulty: BotDifficulty): Promise<ApiResult<GameSnapshot>> {
    const parsed = addBotBodySchema.safeParse({ difficulty });
    if (!parsed.success) {
      return bodyError(ApiError.InvalidBody);
    }
    return this.api.post(`/api/games/${gameId}/bot`, parsed.data, gameSnapshotSchema);
  }

  async agreeNextWind(gameId: string): Promise<ApiResult<GameSnapshot>> {
    return this.api.post(`/api/games/${gameId}/next-wind`, undefined, gameSnapshotSchema);
  }
}

function bodyError(error: ApiError): ApiErr {
  return { ok: false, error, status: HttpStatus.UnprocessableEntity };
}
