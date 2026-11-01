import { MeldType } from "../../../types/server/meldType";
import { RoundPhase } from "../../../types/server/roundPhase";
import { TileKind } from "../../../types/server/tile";
import { parseTileCode } from "../../server/game/tileCode";

export enum SuggestedAction {
  Win = "win",
  Kong = "kong",
  Pong = "pong",
  Chow = "chow",
  Discard = "discard",
  Draw = "draw",
}

const seatCount = 4;
const offerOrder: MeldType[] = [MeldType.Kong, MeldType.Pong, MeldType.Chow];

export type SuggestHandTile = {
  id: string;
  tileCode: string;
};

export type SuggestMeld = {
  meldType: MeldType;
  tiles: { tileCode: string }[];
};

export type ClaimOffer = {
  kind: MeldType;
  tileIds: string[];
};

export type ActionSuggestion = {
  suggested: SuggestedAction | null;
  offers: ClaimOffer[];
  showWin: boolean;
  showPass: boolean;
};

export function liveDiscard(input: {
  phase: RoundPhase | null;
  claimTileCode: string | null;
  claimDiscardSeatIndex: number | null;
  discards: { seatIndex: number; tileCode: string; sortIndex: number }[];
}): { seatIndex: number; tileCode: string } | null {
  if (input.phase !== RoundPhase.Claim && input.phase !== RoundPhase.RobKong) {
    return null;
  }
  if (input.claimTileCode != null && input.claimDiscardSeatIndex != null) {
    return { seatIndex: input.claimDiscardSeatIndex, tileCode: input.claimTileCode };
  }
  const latest = input.discards.reduce<
    { seatIndex: number; tileCode: string; sortIndex: number } | undefined
  >((best, tile) => {
    if (best == null || tile.sortIndex >= best.sortIndex) {
      return tile;
    }
    return best;
  }, undefined);
  if (latest == null) {
    return null;
  }
  return { seatIndex: latest.seatIndex, tileCode: latest.tileCode };
}

export function suggestAction(input: {
  phase: RoundPhase | null;
  selfSeatIndex: number | null;
  hand: SuggestHandTile[];
  selectedTileIds: string[];
  melds: SuggestMeld[];
  discardSeatIndex: number | null;
  discardTileCode: string | null;
  chowOnlyFromPrevious: boolean;
  canDeclareWin: boolean;
  canDraw: boolean;
  canDiscard: boolean;
}): ActionSuggestion {
  const inWindow = input.phase === RoundPhase.Claim || input.phase === RoundPhase.RobKong;
  const isDiscarder =
    inWindow &&
    input.discardSeatIndex != null &&
    input.selfSeatIndex != null &&
    input.discardSeatIndex === input.selfSeatIndex;
  const offers: ClaimOffer[] = [];
  if (
    input.phase === RoundPhase.Claim &&
    !isDiscarder &&
    input.discardTileCode != null &&
    input.selfSeatIndex != null &&
    input.discardSeatIndex != null
  ) {
    pushOffer(
      offers,
      MeldType.Kong,
      matchingIds(input.hand, input.discardTileCode, 3, input.selectedTileIds),
    );
    pushOffer(
      offers,
      MeldType.Pong,
      matchingIds(input.hand, input.discardTileCode, 2, input.selectedTileIds),
    );
    if (canChow(input.selfSeatIndex, input.discardSeatIndex, input.chowOnlyFromPrevious)) {
      pushOffer(
        offers,
        MeldType.Chow,
        chowIds(input.hand, input.discardTileCode, input.selectedTileIds),
      );
    }
  }
  if (input.phase === RoundPhase.Discard && input.canDiscard && !inWindow) {
    pushOffer(offers, MeldType.Kong, ownKongIds(input.hand, input.melds, input.selectedTileIds));
  }
  offers.sort((left, right) => offerOrder.indexOf(left.kind) - offerOrder.indexOf(right.kind));
  const showWin =
    input.canDeclareWin && !isDiscarder && (inWindow || input.selectedTileIds.length > 0);
  const showPass = inWindow && !isDiscarder;
  return {
    suggested: suggestedAction(input, offers, showWin, inWindow, isDiscarder),
    offers,
    showWin,
    showPass,
  };
}

export function claimTrayOpen(suggestion: ActionSuggestion): boolean {
  return suggestion.showPass || suggestion.showWin || suggestion.offers.length > 0;
}

export function timerSeconds(
  turnRemainingMs: number | null,
  claimTimeoutMs: number | null,
): number | null {
  const remaining = turnRemainingMs ?? claimTimeoutMs;
  if (remaining == null) {
    return null;
  }
  return Math.ceil(remaining / 1000);
}

function suggestedAction(
  input: {
    canDraw: boolean;
    canDiscard: boolean;
    selectedTileIds: string[];
  },
  offers: ClaimOffer[],
  showWin: boolean,
  inWindow: boolean,
  isDiscarder: boolean,
): SuggestedAction | null {
  if (inWindow && !isDiscarder && showWin) {
    return SuggestedAction.Win;
  }
  if (offers.some((offer) => offer.kind === MeldType.Kong)) {
    return SuggestedAction.Kong;
  }
  if (offers.some((offer) => offer.kind === MeldType.Pong)) {
    return SuggestedAction.Pong;
  }
  if (offers.some((offer) => offer.kind === MeldType.Chow)) {
    return SuggestedAction.Chow;
  }
  if (input.canDraw) {
    return SuggestedAction.Draw;
  }
  if (input.canDiscard && input.selectedTileIds.length <= 1) {
    return SuggestedAction.Discard;
  }
  return null;
}

function pushOffer(offers: ClaimOffer[], kind: MeldType, tileIds: string[] | undefined) {
  if (tileIds == null) {
    return;
  }
  offers.push({ kind, tileIds });
}

function canChow(
  selfSeatIndex: number,
  discardSeatIndex: number,
  chowOnlyFromPrevious: boolean,
): boolean {
  if (!chowOnlyFromPrevious) {
    return true;
  }
  return (discardSeatIndex + 1) % seatCount === selfSeatIndex;
}

function matchingIds(
  hand: SuggestHandTile[],
  tileCode: string,
  count: number,
  selectedTileIds: string[],
): string[] | undefined {
  const matches = hand.filter((tile) => tile.tileCode === tileCode);
  if (matches.length < count) {
    return undefined;
  }
  const selected = new Set(selectedTileIds);
  const picked = matches.filter((tile) => selected.has(tile.id));
  const chosen = picked.length === count ? picked : matches.slice(0, count);
  return chosen.map((tile) => tile.id);
}

function chowIds(
  hand: SuggestHandTile[],
  discardCode: string,
  selectedTileIds: string[],
): string[] | undefined {
  const parsed = parseTileCode(discardCode);
  if (
    parsed == null ||
    parsed.kind !== TileKind.Suited ||
    parsed.suit == null ||
    parsed.rank == null
  ) {
    return undefined;
  }
  const patterns = [
    [parsed.rank - 2, parsed.rank - 1],
    [parsed.rank - 1, parsed.rank + 1],
    [parsed.rank + 1, parsed.rank + 2],
  ];
  const selected = new Set(selectedTileIds);
  const viable: string[][] = [];
  for (const ranks of patterns) {
    if (ranks.some((rank) => rank < 1 || rank > 9)) {
      continue;
    }
    const ids = takeRanks(hand, parsed.suit, ranks, selected);
    if (ids != null) {
      viable.push(ids);
    }
  }
  const exact = viable.find(
    (ids) => ids.length === selectedTileIds.length && ids.every((id) => selected.has(id)),
  );
  return exact ?? viable[0];
}

function takeRanks(
  hand: SuggestHandTile[],
  suit: string,
  ranks: number[],
  prefer: Set<string>,
): string[] | undefined {
  const used = new Set<string>();
  const ids: string[] = [];
  for (const rank of ranks) {
    const code = `${suit}_${rank}`;
    const matches = hand.filter((tile) => tile.tileCode === code && !used.has(tile.id));
    const picked = matches.find((tile) => prefer.has(tile.id)) ?? matches[0];
    if (picked == null) {
      return undefined;
    }
    used.add(picked.id);
    ids.push(picked.id);
  }
  return ids;
}

function ownKongIds(
  hand: SuggestHandTile[],
  melds: SuggestMeld[],
  selectedTileIds: string[],
): string[] | undefined {
  const selected = new Set(selectedTileIds);
  const concealed = concealedKongIds(hand, selected);
  const added = addedKongId(hand, melds, selected);
  if (
    selectedTileIds.length === 4 &&
    concealed != null &&
    concealed.every((id) => selected.has(id))
  ) {
    return concealed;
  }
  if (selectedTileIds.length === 1 && added != null && selected.has(added)) {
    return [added];
  }
  if (selectedTileIds.length === 0) {
    return concealed ?? (added == null ? undefined : [added]);
  }
  return undefined;
}

function concealedKongIds(hand: SuggestHandTile[], prefer: Set<string>): string[] | undefined {
  const groups = new Map<string, SuggestHandTile[]>();
  for (const tile of hand) {
    const group = groups.get(tile.tileCode) ?? [];
    group.push(tile);
    groups.set(tile.tileCode, group);
  }
  let fallback: string[] | undefined;
  for (const group of groups.values()) {
    if (group.length < 4) {
      continue;
    }
    const ids = group.slice(0, 4).map((tile) => tile.id);
    if (ids.every((id) => prefer.has(id))) {
      return ids;
    }
    fallback ??= ids;
  }
  return fallback;
}

function addedKongId(
  hand: SuggestHandTile[],
  melds: SuggestMeld[],
  prefer: Set<string>,
): string | undefined {
  const pongCodes = new Set(
    melds
      .filter((meld) => meld.meldType === MeldType.Pong)
      .map((meld) => meld.tiles[0]?.tileCode)
      .filter((code) => code != null),
  );
  const match = hand.find((tile) => pongCodes.has(tile.tileCode) && prefer.has(tile.id));
  if (match != null) {
    return match.id;
  }
  return hand.find((tile) => pongCodes.has(tile.tileCode))?.id;
}
