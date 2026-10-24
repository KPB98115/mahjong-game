import {
  sessionResponseSchema,
  socketTicketSchema,
  type SessionResponse,
  type SocketTicketOk,
} from "../../../model/server/actionResult";
import {
  playerProfileModelFrom,
  type PlayerProfileModel,
} from "../../../model/client/playerProfileModel";
import { patchMeBodySchema } from "../../../model/server/playerProfile";
import { profileResponseSchema } from "../../../model/server/profileResponse";
import { ApiError, HttpStatus } from "../../../types/server/api";
import { UserAttributeName } from "../../../types/server/profile";
import { type ApiClient, type ApiResult } from "../http/apiClient";

const displayNameMinLength = 1;
const displayNameMaxLength = 32;

export class AuthLogic {
  constructor(readonly api: ApiClient) {}

  async ensureSession(): Promise<ApiResult<SessionResponse>> {
    return this.api.post("/api/session", undefined, sessionResponseSchema);
  }

  async loadProfile(): Promise<ApiResult<PlayerProfileModel>> {
    const result = await this.api.get("/api/me", profileResponseSchema);
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: playerProfileModelFrom(result.data) };
  }

  async saveDisplayName(displayName: string): Promise<ApiResult<PlayerProfileModel>> {
    const trimmed = displayName.trim();
    if (trimmed.length < displayNameMinLength || trimmed.length > displayNameMaxLength) {
      return {
        ok: false,
        error: ApiError.InvalidBody,
        status: HttpStatus.UnprocessableEntity,
      };
    }
    const body = patchMeBodySchema.parse({
      attributes: { [UserAttributeName.DisplayName]: trimmed },
    });
    const result = await this.api.patch("/api/me", body, profileResponseSchema);
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: playerProfileModelFrom(result.data) };
  }

  async mintSocketTicket(): Promise<ApiResult<SocketTicketOk>> {
    return this.api.post("/api/socket-ticket", undefined, socketTicketSchema);
  }
}
