import { BOARD_TILES, MINIGAME_IDS, SPINNER_SEGMENTS, getTileById } from '../data/tiles';
import {
  BOARD_TILE_COUNT,
  COUNTER_SYMBOLS,
  DEFAULT_SETTINGS,
  FINISH_POSITION,
  HISTORY_LIMIT,
  MAX_CHAINED_MOVES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  START_POSITION,
  type Assignment,
  type BoardTile,
  type GameEvent,
  type GameSettings,
  type GameState,
  type MinigameId,
  type PendingRoll,
  type Placement,
  type Player,
  type PlayerDraft,
  type PlayerStatistics,
  type SpinnerSegmentId,
  type TileChoice,
  type TileResolution,
} from '../types/game';
import { createId } from '../utils/ids';
import { normaliseName } from '../utils/text';
import type { RandomSource } from './random';

interface RandomOutcome {
  label: string;
  assignments?: Assignment[];
  movement?: number;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const EMPTY_STATS: PlayerStatistics = {
  turnsTaken: 0,
  minigamesWon: 0,
  minigamesLost: 0,
  shieldsUsed: 0,
  drinksGiven: 0,
  shotsGiven: 0,
  largestSingleAssignment: 0,
};

function cloneStats(): PlayerStatistics {
  return { ...EMPTY_STATS };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      temporaryEffects: player.temporaryEffects.map((effect) => ({ ...effect })),
      statistics: { ...player.statistics },
    })),
    placements: state.placements.map((placement) => ({ ...placement })),
    globalEffects: state.globalEffects.map((effect) => ({ ...effect })),
    currentTileResolution: state.currentTileResolution ? { ...state.currentTileResolution } : null,
    pendingRoll: state.pendingRoll
      ? { ...state.pendingRoll, path: [...state.pendingRoll.path] }
      : null,
    resolvedTileIdsThisTurn: [...state.resolvedTileIdsThisTurn],
    history: state.history.map((event) => ({ ...event })),
    turnSnapshot: null,
  };
}

function snapshotState(state: GameState, rollValue: number | null): GameState['turnSnapshot'] {
  const copy = cloneState(state);
  return {
    gameState: copy,
    rollValue,
  };
}

function elapsedMs(state: GameState): number {
  const startedAt = state.startedAt ? Date.parse(state.startedAt) : Date.parse(state.createdAt);
  if (!Number.isFinite(startedAt)) {
    return 0;
  }
  return Math.max(0, Date.now() - startedAt);
}

export function addHistory(state: GameState, message: string): GameState {
  const event: GameEvent = {
    id: createId('event'),
    turnNumber: state.turnNumber,
    message,
    elapsedMs: elapsedMs(state),
  };
  return {
    ...state,
    history: [...state.history, event].slice(-HISTORY_LIMIT),
  };
}

export function validatePlayerDrafts(drafts: PlayerDraft[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmedNames = drafts.map((draft) => normaliseName(draft.name));
  const colours = drafts.map((draft) => draft.colour);

  if (drafts.length < MIN_PLAYERS) {
    errors.push(`Add at least ${MIN_PLAYERS} players.`);
  }
  if (drafts.length > MAX_PLAYERS) {
    errors.push(`Keep the game to ${MAX_PLAYERS} players or fewer.`);
  }
  if (trimmedNames.some((name) => name.length === 0)) {
    errors.push('Every player needs a name.');
  }
  if (new Set(colours).size !== colours.length) {
    errors.push('Each player needs a unique counter colour.');
  }
  if (new Set(trimmedNames.map((name) => name.toLocaleLowerCase())).size !== trimmedNames.length) {
    warnings.push('Two players have the same name. That is allowed, but it may be confusing.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function createPlayerDraft(index: number): PlayerDraft {
  return {
    id: createId('draft'),
    name: `Player ${index + 1}`,
    colour: DEFAULT_PLAYER_COLOUR(index),
    counterSymbol: COUNTER_SYMBOLS[index % COUNTER_SYMBOLS.length],
  };
}

function DEFAULT_PLAYER_COLOUR(index: number): string {
  const colours = [
    '#ff4f5e',
    '#3d8bfd',
    '#2fd172',
    '#9b5cff',
    '#ff9f1c',
    '#2ee6d6',
    '#ff70c8',
    '#b7ff30',
    '#f7f7f7',
    '#ffd400',
  ];
  return colours[index % colours.length];
}

function createPlayer(draft: PlayerDraft): Player {
  return {
    id: createId('player'),
    name: normaliseName(draft.name),
    colour: draft.colour,
    counterSymbol: draft.counterSymbol,
    position: START_POSITION,
    drinks: 0,
    shots: 0,
    shields: 0,
    goldenShields: 0,
    finished: false,
    temporaryEffects: [],
    statistics: cloneStats(),
  };
}

export function createNewGame(
  drafts: PlayerDraft[],
  settings: GameSettings = DEFAULT_SETTINGS,
  random: RandomSource,
): GameState {
  const validation = validatePlayerDrafts(drafts);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const orderedDrafts = settings.randomInitialOrder ? random.shuffle(drafts) : [...drafts];
  const now = new Date().toISOString();
  let state: GameState = {
    id: createId('game'),
    status: 'active',
    players: orderedDrafts.map(createPlayer),
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnPhase: 'awaiting-turn-start',
    placements: [],
    globalEffects: [],
    currentTileResolution: null,
    pendingRoll: null,
    chainedMovesThisTurn: 0,
    resolvedTileIdsThisTurn: [],
    history: [],
    startedAt: now,
    completedAt: null,
    createdAt: now,
    turnSnapshot: null,
  };

  state = addHistory(state, 'Game started.');
  return startTurn(state);
}

export function getCurrentPlayer(state: GameState): Player {
  const player = state.players[state.currentPlayerIndex];
  if (!player) {
    throw new Error('Current player is invalid');
  }
  return player;
}

export function getUnfinishedPlayers(state: GameState): Player[] {
  return state.players.filter((player) => !player.finished);
}

export function getEligibleTargets(
  state: GameState,
  includeCurrent: boolean,
  includeFinished = false,
): Player[] {
  const current = getCurrentPlayer(state);
  return state.players.filter((player) => {
    if (!includeFinished && player.finished) {
      return false;
    }
    if (!includeCurrent && player.id === current.id) {
      return false;
    }
    return true;
  });
}

export function startTurn(state: GameState): GameState {
  if (state.status !== 'active') {
    return state;
  }
  const current = getCurrentPlayer(state);
  if (current.finished) {
    return moveToNextTurn(state);
  }
  return addHistory(
    {
      ...state,
      turnPhase: 'awaiting-roll',
      currentTileResolution: null,
      pendingRoll: null,
      chainedMovesThisTurn: 0,
      resolvedTileIdsThisTurn: [],
    },
    `${current.name}'s turn started.`,
  );
}

export function rollDice(
  state: GameState,
  settings: GameSettings,
  random: RandomSource,
): GameState {
  if (state.turnPhase !== 'awaiting-roll') {
    throw new Error('Cannot roll right now');
  }
  const current = getCurrentPlayer(state);
  const value = random.integer(1, 6);
  const rawTarget = current.position + value;
  const overshotExactFinish = settings.exactRollToFinish && rawTarget > FINISH_POSITION;
  const target = overshotExactFinish ? current.position : Math.min(rawTarget, FINISH_POSITION);
  const path = buildPath(current.position, target);
  const pendingRoll: PendingRoll = {
    value,
    from: current.position,
    target,
    path,
    overshotExactFinish,
  };
  const next = addHistory(
    {
      ...state,
      turnPhase: 'rolling',
      pendingRoll,
      turnSnapshot: snapshotState(state, value),
    },
    `${current.name} rolled ${value}.`,
  );

  return overshotExactFinish
    ? addHistory(
        {
          ...next,
          turnPhase: 'confirming-result',
        },
        `${current.name} needed an exact finish and stayed put.`,
      )
    : next;
}

export function beginMovement(state: GameState): GameState {
  if (state.turnPhase !== 'rolling' || !state.pendingRoll) {
    return state;
  }
  if (state.pendingRoll.path.length === 0) {
    return {
      ...state,
      turnPhase: 'confirming-result',
    };
  }
  return {
    ...state,
    turnPhase: 'moving',
  };
}

export function stepMovement(state: GameState): GameState {
  if (state.turnPhase !== 'moving' || !state.pendingRoll) {
    return state;
  }
  const [nextPosition, ...remainingPath] = state.pendingRoll.path;
  if (nextPosition === undefined) {
    return finishMovement(state);
  }

  const moved = updatePlayer(state, getCurrentPlayer(state).id, (player) => ({
    ...player,
    position: nextPosition,
  }));
  const nextState = {
    ...moved,
    pendingRoll: {
      ...state.pendingRoll,
      path: remainingPath,
    },
  };

  if (remainingPath.length === 0) {
    return finishMovement(nextState);
  }
  return nextState;
}

export function finishMovement(state: GameState): GameState {
  const current = getCurrentPlayer(state);
  if (current.position >= FINISH_POSITION) {
    return markCurrentPlayerFinished(state);
  }
  const tile = getTileById(current.position);
  if (!tile) {
    return addHistory(
      {
        ...state,
        turnPhase: 'turn-complete',
        currentTileResolution: null,
      },
      `${current.name} landed on an unknown space and the turn was skipped safely.`,
    );
  }
  return addHistory(
    {
      ...state,
      turnPhase: 'resolving-tile',
      currentTileResolution: tileToResolution(tile, state.turnNumber),
      resolvedTileIdsThisTurn: [...state.resolvedTileIdsThisTurn, tile.id],
    },
    `${current.name} landed on ${tile.title}.`,
  );
}

export function advanceMovementToEnd(state: GameState): GameState {
  let next = state.turnPhase === 'rolling' ? beginMovement(state) : state;
  while (next.turnPhase === 'moving') {
    next = stepMovement(next);
  }
  return next;
}

export function resolveCurrentTile(
  state: GameState,
  settings: GameSettings,
  random: RandomSource,
  choice: TileChoice = {},
): GameState {
  if (state.turnPhase === 'confirming-result' && state.pendingRoll?.overshotExactFinish) {
    return completeTurn(addHistory(state, 'Turn ended after exact-finish overshoot.'));
  }

  if (state.turnPhase !== 'resolving-tile' || !state.currentTileResolution) {
    throw new Error('No tile is waiting to resolve');
  }

  const tile = getTileById(state.currentTileResolution.tileId);
  if (!tile) {
    return completeTurn(addHistory(state, 'Missing tile data. Turn skipped safely.'));
  }

  if (choice.skip) {
    return completeTurn(addHistory(state, `${tile.title} was skipped.`));
  }

  const next = tileActionHandlers[tile.actionType](state, tile, settings, random, choice);
  const advancedToNewTile =
    next.turnPhase === 'resolving-tile' &&
    next.currentTileResolution !== null &&
    next.currentTileResolution.tileId !== state.currentTileResolution.tileId;
  if (advancedToNewTile || next.turnPhase === 'game-complete') {
    return next;
  }
  return completeTurn(next);
}

export function completeTurn(state: GameState): GameState {
  if (state.status === 'complete') {
    return state;
  }
  return {
    ...state,
    turnPhase: 'turn-complete',
    currentTileResolution: null,
    pendingRoll: null,
  };
}

export function moveToNextTurn(state: GameState): GameState {
  if (state.status !== 'active') {
    return state;
  }
  if (state.players.every((player) => player.finished)) {
    return completeGame(state);
  }

  const nextIndex = nextActivePlayerIndex(state, state.currentPlayerIndex);
  const clearedPlayers = state.players.map((player) => ({
    ...player,
    temporaryEffects: player.temporaryEffects.filter(
      (effect) => effect.expiresOnTurn > state.turnNumber,
    ),
  }));
  return startTurn({
    ...state,
    players: clearedPlayers,
    currentPlayerIndex: nextIndex,
    turnNumber: state.turnNumber + 1,
  });
}

export function restartTurn(state: GameState): GameState {
  if (!state.turnSnapshot) {
    return state;
  }
  const snapshot = cloneState(state.turnSnapshot.gameState);
  if (state.turnSnapshot.rollValue !== null) {
    return rollWithFixedValue(snapshot, state.turnSnapshot.rollValue);
  }
  return snapshot;
}

export function rollWithFixedValue(state: GameState, value: number): GameState {
  if (state.turnPhase !== 'awaiting-roll') {
    throw new Error('Cannot replay roll right now');
  }
  const source = {
    integer: () => value,
    pick: <T>(items: readonly T[]) => items[0],
    shuffle: <T>(items: readonly T[]) => [...items],
  };
  return rollDice(state, DEFAULT_SETTINGS, source);
}

export function applyManualAdjustment(
  state: GameState,
  playerId: string,
  drinksDelta: number,
  shotsDelta: number,
): GameState {
  const adjusted = updatePlayer(state, playerId, (player) => ({
    ...player,
    drinks: Math.max(0, player.drinks + drinksDelta),
    shots: Math.max(0, player.shots + shotsDelta),
  }));
  const player = adjusted.players.find((entry) => entry.id === playerId);
  return addHistory(adjusted, `${player?.name ?? 'A player'} score was adjusted.`);
}

export function playAgainWithSamePlayers(state: GameState): GameState {
  const now = new Date().toISOString();
  const resetPlayers = state.players.map((player) => ({
    ...player,
    position: START_POSITION,
    drinks: 0,
    shots: 0,
    shields: 0,
    goldenShields: 0,
    finished: false,
    placement: undefined,
    temporaryEffects: [],
    statistics: cloneStats(),
  }));
  return startTurn({
    ...state,
    id: createId('game'),
    status: 'active',
    players: resetPlayers,
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnPhase: 'awaiting-turn-start',
    placements: [],
    globalEffects: [],
    currentTileResolution: null,
    pendingRoll: null,
    chainedMovesThisTurn: 0,
    resolvedTileIdsThisTurn: [],
    history: [],
    startedAt: now,
    completedAt: null,
    createdAt: now,
    turnSnapshot: null,
  });
}

function buildPath(from: number, target: number): number[] {
  const path: number[] = [];
  for (let position = from + 1; position <= target; position += 1) {
    path.push(position);
  }
  return path;
}

function tileToResolution(tile: BoardTile, turnNumber: number): TileResolution {
  const minigameId = tile.actionConfig?.minigameId;
  return {
    tileId: tile.id,
    tileTitle: tile.title,
    actionType: tile.actionType,
    startedAtTurn: turnNumber,
    minigameId: isMinigameId(minigameId) ? minigameId : undefined,
  };
}

function isMinigameId(value: unknown): value is MinigameId {
  return typeof value === 'string' && MINIGAME_IDS.includes(value as MinigameId);
}

function nextActivePlayerIndex(state: GameState, fromIndex: number): number {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    if (!state.players[index].finished) {
      return index;
    }
  }
  return fromIndex;
}

function previousActivePlayer(state: GameState): Player {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (state.currentPlayerIndex - offset + state.players.length) % state.players.length;
    if (!state.players[index].finished) {
      return state.players[index];
    }
  }
  return getCurrentPlayer(state);
}

function updatePlayer(
  state: GameState,
  playerId: string,
  updater: (player: Player) => Player,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
  };
}

function markCurrentPlayerFinished(state: GameState): GameState {
  const current = getCurrentPlayer(state);
  if (current.finished) {
    return state;
  }
  const place = state.placements.length + 1;
  const placement: Placement = {
    playerId: current.id,
    place,
    turnNumber: state.turnNumber,
  };
  const updated = updatePlayer(state, current.id, (player) => ({
    ...player,
    position: FINISH_POSITION,
    finished: true,
    placement: place,
  }));
  const placed = addHistory(
    {
      ...updated,
      placements: [...updated.placements, placement],
      currentTileResolution: null,
      pendingRoll: null,
    },
    `${current.name} finished in place ${place}.`,
  );
  if (placed.players.every((player) => player.finished)) {
    return completeGame(placed);
  }
  return {
    ...placed,
    turnPhase: 'turn-complete',
  };
}

function completeGame(state: GameState): GameState {
  return addHistory(
    {
      ...state,
      status: 'complete',
      turnPhase: 'game-complete',
      completedAt: new Date().toISOString(),
      currentTileResolution: null,
      pendingRoll: null,
    },
    'Game complete.',
  );
}

function resolveAssignments(
  state: GameState,
  assignments: Assignment[],
  settings: GameSettings,
  random: RandomSource,
  choice: TileChoice,
): GameState {
  return assignments.reduce(
    (nextState, assignment) => applyAssignment(nextState, assignment, settings, random, choice),
    state,
  );
}

function applyAssignment(
  state: GameState,
  assignment: Assignment,
  settings: GameSettings,
  random: RandomSource,
  choice: TileChoice,
): GameState {
  const scaledAssignment = scaleAssignmentForDifficulty(state, assignment, settings);
  const targets = resolveAssignmentTargets(state, assignment, random, choice);
  return targets.reduce((nextState, target) => {
    const result = updatePlayer(nextState, target.id, (player) => {
      const drinkCount = scaledAssignment.drinks ?? 0;
      const shotCount = scaledAssignment.shots ?? 0;
      const useShield =
        choice.shieldUsedByPlayerId === player.id && drinkCount > 0 && player.shields > 0;
      const useGolden =
        choice.shieldUsedByPlayerId === player.id && shotCount > 0 && player.goldenShields > 0;
      const effectiveDrinks = Math.max(0, drinkCount - (useShield ? 1 : 0));
      const effectiveShots = Math.max(0, shotCount - (useGolden ? 1 : 0));
      const largest = Math.max(
        player.statistics.largestSingleAssignment,
        effectiveDrinks + effectiveShots,
      );

      return {
        ...player,
        drinks: Math.max(0, player.drinks + effectiveDrinks - (scaledAssignment.removeDrinks ?? 0)),
        shots: Math.max(0, player.shots + effectiveShots - (scaledAssignment.removeShots ?? 0)),
        shields: Math.max(
          0,
          player.shields + (scaledAssignment.shields ?? 0) - (useShield ? 1 : 0),
        ),
        goldenShields: Math.max(
          0,
          player.goldenShields + (scaledAssignment.goldenShields ?? 0) - (useGolden ? 1 : 0),
        ),
        statistics: {
          ...player.statistics,
          shieldsUsed: player.statistics.shieldsUsed + (useShield || useGolden ? 1 : 0),
          largestSingleAssignment: largest,
        },
      };
    });

    const targetAfter = result.players.find((player) => player.id === target.id) ?? target;
    const messages = assignmentMessages(target.name, targetAfter, scaledAssignment);
    return messages.reduce((messageState, message) => addHistory(messageState, message), result);
  }, state);
}

function scaleAssignmentForDifficulty(
  state: GameState,
  assignment: Assignment,
  settings: GameSettings,
): Assignment {
  if (settings.difficulty !== 'blackout') {
    return assignment;
  }

  const current = getCurrentPlayer(state);
  const progress = current.position / FINISH_POSITION;
  const drinks = assignment.drinks ?? 0;
  const shots = assignment.shots ?? 0;

  if (drinks <= 0 && shots <= 0) {
    return assignment;
  }

  const lateDrinkBonus = drinks > 0 && progress >= 0.68 && assignment.target !== 'everyone' ? 1 : 0;
  const finishLineDrinkBonus = shots > 0 && progress >= 0.82 ? 1 : 0;

  return {
    ...assignment,
    drinks: drinks + lateDrinkBonus + finishLineDrinkBonus || undefined,
    shots: shots || undefined,
  };
}

function assignmentMessages(targetName: string, target: Player, assignment: Assignment): string[] {
  const messages: string[] = [];
  if (assignment.drinks) {
    messages.push(
      `${targetName} received ${assignment.drinks} drink${assignment.drinks === 1 ? '' : 's'}. Total: ${target.drinks}.`,
    );
  }
  if (assignment.shots) {
    messages.push(
      `${targetName} received ${assignment.shots} shot${assignment.shots === 1 ? '' : 's'}. Total: ${target.shots}.`,
    );
  }
  if (assignment.removeDrinks) {
    messages.push(
      `${targetName} removed ${assignment.removeDrinks} drink${assignment.removeDrinks === 1 ? '' : 's'}.`,
    );
  }
  if (assignment.removeShots) {
    messages.push(
      `${targetName} removed ${assignment.removeShots} shot${assignment.removeShots === 1 ? '' : 's'}.`,
    );
  }
  if (assignment.shields) {
    messages.push(`${targetName} gained ${assignment.shields} Shield.`);
  }
  if (assignment.goldenShields) {
    messages.push(`${targetName} gained ${assignment.goldenShields} Golden Shield.`);
  }
  return messages;
}

function resolveAssignmentTargets(
  state: GameState,
  assignment: Assignment,
  random: RandomSource,
  choice: TileChoice,
): Player[] {
  const current = getCurrentPlayer(state);
  switch (assignment.target) {
    case 'current':
      return [current];
    case 'chosen': {
      if (assignment.autoNext) {
        const nextPlayer = state.players[nextActivePlayerIndex(state, state.currentPlayerIndex)];
        return nextPlayer ? [nextPlayer] : [current];
      }
      if (assignment.secondary) {
        const secondary =
          state.players.find(
            (player) => player.id === choice.secondaryTargetPlayerId && !player.finished,
          ) ?? getEligibleTargets(state, false)[0];
        return secondary ? [secondary] : [current];
      }
      const id = choice.targetPlayerId;
      const fallback = getEligibleTargets(state, true)[0];
      const target =
        state.players.find((player) => player.id === id && !player.finished) ?? fallback;
      return [target].filter(Boolean);
    }
    case 'random':
      return [random.pick(getEligibleTargets(state, true))];
    case 'previous':
      return [previousActivePlayer(state)];
    case 'everyone':
      return getEligibleTargets(state, true);
    case 'everyoneExceptCurrent':
      return getEligibleTargets(state, false);
  }
}

function getAssignments(tile: BoardTile): Assignment[] {
  const assignments = tile.actionConfig?.assignments;
  if (!Array.isArray(assignments)) {
    return [];
  }
  return assignments.filter(isAssignment);
}

function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const target = (value as { target?: unknown }).target;
  return typeof target === 'string';
}

function getNumber(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = config?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOutcomes(tile: BoardTile): RandomOutcome[] {
  const outcomes = tile.actionConfig?.outcomes;
  if (!Array.isArray(outcomes)) {
    return [];
  }
  return outcomes.filter((outcome): outcome is RandomOutcome => {
    if (!outcome || typeof outcome !== 'object') {
      return false;
    }
    return typeof (outcome as { label?: unknown }).label === 'string';
  });
}

type TileActionHandler = (
  state: GameState,
  tile: BoardTile,
  settings: GameSettings,
  random: RandomSource,
  choice: TileChoice,
) => GameState;

export const tileActionHandlers: Record<BoardTile['actionType'], TileActionHandler> = {
  assign: (state, tile, _settings, random, choice) =>
    resolveAssignments(state, getAssignments(tile), _settings, random, choice),
  choice: (state, tile, _settings, random, choice) =>
    resolveAssignments(state, getAssignments(tile), _settings, random, choice),
  group: (state, tile, _settings, random, choice) => {
    if (tile.actionConfig?.halfRound === true) {
      const currentIndex = state.currentPlayerIndex;
      const targets = state.players.filter(
        (player, index) => !player.finished && (index + currentIndex) % 2 === 0,
      );
      return targets.reduce(
        (nextState, target) =>
          resolveAssignments(
            nextState,
            [{ target: 'chosen', drinks: getNumber(tile.actionConfig, 'drinks', 1) }],
            _settings,
            random,
            { ...choice, targetPlayerId: target.id },
          ),
        state,
      );
    }
    return resolveAssignments(state, getAssignments(tile), _settings, random, choice);
  },
  shield: (state, tile, _settings, random, choice) => {
    const target = tile.actionConfig?.target === 'everyone' ? 'everyone' : 'current';
    const assignment: Assignment = {
      target,
      shields: getNumber(tile.actionConfig, 'shields', 0),
      goldenShields: getNumber(tile.actionConfig, 'goldenShields', 0),
    };
    return resolveAssignments(state, [assignment], _settings, random, choice);
  },
  recover: (state, tile, _settings, random, choice) =>
    resolveAssignments(state, getAssignments(tile), _settings, random, choice),
  movement: (state, tile, settings, random, choice) =>
    applyMovementTile(state, tile, settings, random, choice),
  minigame: (state, tile, _settings, random, choice) => {
    const loserId = choice.minigameNoPenalty
      ? undefined
      : (choice.minigameLoserId ?? choice.targetPlayerId);
    const winnerId = choice.minigameWinnerId;
    let next = state;
    if (loserId) {
      const drinks = getNumber(tile.actionConfig, 'loserDrinks', 1);
      next = resolveAssignments(next, [{ target: 'chosen', drinks }], _settings, random, {
        ...choice,
        targetPlayerId: loserId,
      });
      next = updatePlayer(next, loserId, (player) => ({
        ...player,
        statistics: { ...player.statistics, minigamesLost: player.statistics.minigamesLost + 1 },
      }));
    }
    if (winnerId) {
      next = updatePlayer(next, winnerId, (player) => ({
        ...player,
        statistics: { ...player.statistics, minigamesWon: player.statistics.minigamesWon + 1 },
      }));
    }
    return addHistory(next, `${tile.title} was resolved.`);
  },
  spinner: (state, _tile, settings, random, choice) =>
    resolveSpinnerResult(
      state,
      choice.spinnerResult ?? pickSpinnerSegment(random),
      settings,
      random,
      choice,
    ),
  vote: (state, tile, _settings, random, choice) => {
    const drinks = getNumber(tile.actionConfig, 'drinks', 1);
    return resolveAssignments(state, [{ target: 'chosen', drinks }], _settings, random, choice);
  },
  'random-outcome': (state, tile, settings, random, choice) => {
    if (tile.actionConfig?.shieldCheck === true) {
      const current = getCurrentPlayer(state);
      if (current.shields > 0) {
        return resolveAssignments(
          state,
          [{ target: 'chosen', drinks: 1 }],
          settings,
          random,
          choice,
        );
      }
      return resolveAssignments(
        state,
        [{ target: 'current', drinks: 1 }],
        settings,
        random,
        choice,
      );
    }

    const outcomes = getOutcomes(tile);
    const outcome = outcomes.length > 0 ? random.pick(outcomes) : undefined;
    if (!outcome) {
      return addHistory(state, `${tile.title} had no effect.`);
    }
    let next = addHistory(state, `${tile.title}: ${outcome.label}.`);
    if (outcome.assignments) {
      next = resolveAssignments(next, outcome.assignments, settings, random, choice);
    }
    if (outcome.movement) {
      next = applyMovementOffset(next, outcome.movement, settings);
    }
    return next;
  },
  buddy: (state, _tile, _settings, _random, choice) => {
    const current = getCurrentPlayer(state);
    const targetId = choice.targetPlayerId;
    const target = state.players.find((player) => player.id === targetId && !player.finished);
    if (!target || target.id === current.id) {
      return addHistory(state, `${current.name} did not choose a buddy.`);
    }
    return updatePlayer(
      addHistory(state, `${current.name} chose ${target.name} as a buddy.`),
      current.id,
      (player) => ({
        ...player,
        temporaryEffects: [
          ...player.temporaryEffects,
          {
            id: createId('effect'),
            type: 'buddy',
            label: `Buddy with ${target.name}`,
            expiresOnTurn: state.turnNumber + state.players.length,
            linkedPlayerId: target.id,
          },
        ],
      }),
    );
  },
  'card-guess': (state, tile, settings, random, choice) => {
    const correct = random.integer(0, 1) === 1;
    const drinks = getNumber(tile.actionConfig, 'drinks', 1);
    return correct
      ? resolveAssignments(
          addHistory(state, 'Card prediction was correct.'),
          [{ target: 'chosen', drinks }],
          settings,
          random,
          choice,
        )
      : resolveAssignments(
          addHistory(state, 'Card prediction missed.'),
          [{ target: 'current', drinks }],
          settings,
          random,
          choice,
        );
  },
  'high-roller': (state, tile, settings, random, choice) => {
    const roll = random.integer(1, 6);
    const lateGame = tile.actionConfig?.lateGame === true;
    const withRoll = addHistory(state, `Bonus die rolled ${roll}.`);
    if (lateGame) {
      if (roll <= 2) {
        return resolveAssignments(
          withRoll,
          [{ target: 'current', shots: 1 }],
          settings,
          random,
          choice,
        );
      }
      if (roll >= 5) {
        return resolveAssignments(
          withRoll,
          [{ target: 'chosen', shots: 1 }],
          settings,
          random,
          choice,
        );
      }
      return addHistory(withRoll, 'Middle roll. No score change.');
    }
    if (roll <= 2) {
      return resolveAssignments(
        withRoll,
        [{ target: 'current', drinks: 2 }],
        settings,
        random,
        choice,
      );
    }
    if (roll >= 5) {
      return resolveAssignments(
        withRoll,
        [{ target: 'chosen', drinks: 2 }],
        settings,
        random,
        choice,
      );
    }
    return addHistory(withRoll, 'Middle roll. No score change.');
  },
  info: (state, tile) =>
    addHistory(state, `${tile.title}: ${String(tile.actionConfig?.message ?? 'No effect.')}`),
};

function resolveSpinnerResult(
  state: GameState,
  segmentId: SpinnerSegmentId,
  settings: GameSettings,
  random: RandomSource,
  choice: TileChoice,
): GameState {
  const withHistory = addHistory(state, `Spinner landed on ${segmentId}.`);
  switch (segmentId) {
    case 'one-drink':
      return resolveAssignments(
        withHistory,
        [{ target: 'current', drinks: 1 }],
        settings,
        random,
        choice,
      );
    case 'two-drinks':
      return resolveAssignments(
        withHistory,
        [{ target: 'current', drinks: 2 }],
        settings,
        random,
        choice,
      );
    case 'one-shot':
      return resolveAssignments(
        withHistory,
        [{ target: 'current', shots: 1 }],
        settings,
        random,
        choice,
      );
    case 'choose-player':
      return resolveAssignments(
        withHistory,
        [{ target: 'chosen', drinks: 1 }],
        settings,
        random,
        choice,
      );
    case 'all-players':
      return resolveAssignments(
        withHistory,
        [{ target: 'everyone', drinks: 1 }],
        settings,
        random,
        choice,
      );
    case 'shield':
      return resolveAssignments(
        withHistory,
        [{ target: 'current', shields: 1 }],
        settings,
        random,
        choice,
      );
    case 'safe':
      return addHistory(withHistory, 'Spinner gave a safe result.');
    case 'spin-again':
      return resolveSpinnerResult(
        withHistory,
        pickSpinnerSegment(random),
        settings,
        random,
        choice,
      );
  }
}

export function pickSpinnerSegment(random: RandomSource): SpinnerSegmentId {
  const total = SPINNER_SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  let cursor = random.integer(1, total);
  for (const segment of SPINNER_SEGMENTS) {
    cursor -= segment.weight;
    if (cursor <= 0) {
      return segment.id;
    }
  }
  return SPINNER_SEGMENTS[SPINNER_SEGMENTS.length - 1].id;
}

export function getSpinnerAngle(segmentId: SpinnerSegmentId): number {
  const index = SPINNER_SEGMENTS.findIndex((segment) => segment.id === segmentId);
  if (index < 0) {
    throw new Error('Invalid spinner segment');
  }
  const segmentSize = 360 / SPINNER_SEGMENTS.length;
  return index * segmentSize + segmentSize / 2;
}

function applyMovementTile(
  state: GameState,
  tile: BoardTile,
  settings: GameSettings,
  random: RandomSource,
  _choice: TileChoice,
): GameState {
  void _choice;
  if (tile.actionConfig?.comeback === true) {
    const current = getCurrentPlayer(state);
    const maxPosition = Math.max(
      ...state.players.filter((player) => !player.finished).map((player) => player.position),
    );
    if (current.position < maxPosition) {
      return applyMovementOffset(state, getNumber(tile.actionConfig, 'offset', 2), settings);
    }
    return resolveAssignments(
      state,
      [{ target: 'current', removeDrinks: 1 }],
      settings,
      random,
      {},
    );
  }
  return applyMovementOffset(state, getNumber(tile.actionConfig, 'offset', 0), settings);
}

function applyMovementOffset(state: GameState, offset: number, settings: GameSettings): GameState {
  if (offset === 0) {
    return addHistory(state, 'Movement effect had no distance.');
  }
  if (state.chainedMovesThisTurn >= MAX_CHAINED_MOVES) {
    return addHistory(state, 'Movement chain limit reached. Turn ends safely.');
  }
  const current = getCurrentPlayer(state);
  const target = Math.max(START_POSITION, Math.min(FINISH_POSITION, current.position + offset));
  if (
    settings.exactRollToFinish &&
    target >= FINISH_POSITION &&
    current.position + offset > FINISH_POSITION
  ) {
    return addHistory(state, `${current.name} needed an exact finish and stayed put.`);
  }
  let moved = updatePlayer(state, current.id, (player) => ({ ...player, position: target }));
  moved = addHistory(
    moved,
    `${current.name} moved ${offset > 0 ? 'forward' : 'back'} ${Math.abs(offset)} spaces.`,
  );
  if (target >= FINISH_POSITION) {
    return markCurrentPlayerFinished(moved);
  }
  const tile = getTileById(target);
  if (
    tile &&
    tile.actionType === 'movement' &&
    !state.resolvedTileIdsThisTurn.includes(tile.id) &&
    state.chainedMovesThisTurn + 1 < MAX_CHAINED_MOVES
  ) {
    return {
      ...moved,
      turnPhase: 'resolving-tile',
      currentTileResolution: tileToResolution(tile, moved.turnNumber),
      chainedMovesThisTurn: moved.chainedMovesThisTurn + 1,
      resolvedTileIdsThisTurn: [...moved.resolvedTileIdsThisTurn, tile.id],
    };
  }
  return {
    ...moved,
    chainedMovesThisTurn: moved.chainedMovesThisTurn + 1,
  };
}

export function validateGameState(state: GameState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placementPlaces = new Set<number>();

  if (state.players.length < MIN_PLAYERS || state.players.length > MAX_PLAYERS) {
    errors.push('Player count is outside the supported range.');
  }
  if (!state.players[state.currentPlayerIndex]) {
    errors.push('Current player index is invalid.');
  }
  for (const player of state.players) {
    if (player.position < START_POSITION || player.position > FINISH_POSITION) {
      errors.push(`${player.name} has an invalid position.`);
    }
    if (player.drinks < 0 || player.shots < 0) {
      errors.push(`${player.name} has a negative score.`);
    }
    if (player.finished && !player.placement) {
      errors.push(`${player.name} is finished without a placement.`);
    }
  }
  for (const placement of state.placements) {
    if (placementPlaces.has(placement.place)) {
      errors.push('Placements contain a duplicate place.');
    }
    placementPlaces.add(placement.place);
  }
  if (state.status === 'active' && state.players.every((player) => player.finished)) {
    warnings.push('All players are finished but the game is still marked active.');
  }
  for (const tile of BOARD_TILES) {
    if (tile.id < 1 || tile.id > BOARD_TILE_COUNT) {
      errors.push(`Tile ${tile.id} is outside the board range.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
