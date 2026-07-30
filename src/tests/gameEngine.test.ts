import { describe, expect, it } from 'vitest';
import {
  advanceMovementToEnd,
  applyManualAdjustment,
  createNewGame,
  finishMovement,
  getCurrentPlayer,
  getEligibleTargets,
  getSpinnerAngle,
  moveToNextTurn,
  pickSpinnerSegment,
  resolveCurrentTile,
  rollDice,
  startTurn,
  validateGameState,
} from '../engine/gameEngine';
import { FixedRandomSource } from '../engine/random';
import { DEFAULT_SETTINGS, FINISH_POSITION } from '../types/game';
import { saveGame, loadGame } from '../services/storage';
import { makeDrafts, makeGame, makeSettings } from './testHelpers';

describe('game engine', () => {
  it('creates a new local game with every player at Start', () => {
    const game = createNewGame(makeDrafts(3), makeSettings(), new FixedRandomSource([1]));

    expect(game.players).toHaveLength(3);
    expect(game.players.every((player) => player.position === 0)).toBe(true);
    expect(game.turnPhase).toBe('awaiting-roll');
  });

  it('preserves player order when random order is off', () => {
    const game = createNewGame(makeDrafts(3), makeSettings(), new FixedRandomSource([3, 2, 1]));

    expect(game.players.map((player) => player.name)).toEqual(['Alex', 'Blair', 'Casey']);
  });

  it('rolls dice in the 1 through 6 range and prevents a second roll', () => {
    const game = makeGame();
    const rolled = rollDice(game, makeSettings(), new FixedRandomSource([6]));

    expect(rolled.pendingRoll?.value).toBe(6);
    expect(() => rollDice(rolled, makeSettings(), new FixedRandomSource([1]))).toThrow();
  });

  it('moves the current player by the rolled amount', () => {
    const game = makeGame();
    const rolled = rollDice(game, makeSettings(), new FixedRandomSource([4]));
    const moved = advanceMovementToEnd(rolled);

    expect(getCurrentPlayer(moved).position).toBe(4);
    expect(moved.turnPhase).toBe('resolving-tile');
  });

  it('keeps a player in place when exact finish is required and roll overshoots', () => {
    const game = {
      ...makeGame(),
      players: makeGame().players.map((player, index) =>
        index === 0 ? { ...player, position: FINISH_POSITION - 1 } : player,
      ),
    };
    const rolled = rollDice(
      game,
      makeSettings({ exactRollToFinish: true }),
      new FixedRandomSource([2]),
    );

    expect(rolled.pendingRoll?.overshotExactFinish).toBe(true);
    expect(getCurrentPlayer(rolled).position).toBe(FINISH_POSITION - 1);
    expect(rolled.turnPhase).toBe('confirming-result');
  });

  it('assigns placements and completes when everyone finishes', () => {
    const base = makeGame(2);
    const firstReady = {
      ...base,
      players: base.players.map((player, index) =>
        index === 0 ? { ...player, position: FINISH_POSITION } : player,
      ),
    };
    const firstFinished = finishMovement(firstReady);
    const nextTurn = moveToNextTurn(firstFinished);
    const secondReady = {
      ...nextTurn,
      players: nextTurn.players.map((player, index) =>
        index === 1 ? { ...player, position: FINISH_POSITION } : player,
      ),
    };
    const complete = finishMovement(secondReady);

    expect(complete.status).toBe('complete');
    expect(complete.placements.map((placement) => placement.place)).toEqual([1, 2]);
  });

  it('skips finished players in turn order', () => {
    const base = makeGame(3);
    const game = {
      ...base,
      players: base.players.map((player, index) =>
        index === 1 ? { ...player, finished: true, placement: 1 } : player,
      ),
    };
    const next = moveToNextTurn(game);

    expect(getCurrentPlayer(next).name).toBe('Casey');
  });

  it('uses a Shield to cancel one standard assignment', () => {
    const base = makeGame();
    const current = getCurrentPlayer(base);
    const game = {
      ...base,
      turnPhase: 'resolving-tile' as const,
      currentTileResolution: {
        tileId: 1,
        tileTitle: 'Welcome Sip',
        startedAtTurn: base.turnNumber,
        actionType: 'assign' as const,
      },
      players: base.players.map((player) =>
        player.id === current.id ? { ...player, shields: 1 } : player,
      ),
    };
    const resolved = resolveCurrentTile(game, makeSettings(), new FixedRandomSource([1]), {
      shieldUsedByPlayerId: current.id,
    });
    const player = resolved.players.find((entry) => entry.id === current.id);

    expect(player?.drinks).toBe(0);
    expect(player?.shields).toBe(0);
    expect(player?.statistics.shieldsUsed).toBe(1);
  });

  it('completes a confirmed tile action without requiring skip', () => {
    const base = makeGame();
    const game = {
      ...base,
      turnPhase: 'resolving-tile' as const,
      currentTileResolution: {
        tileId: 1,
        tileTitle: 'Welcome Sip',
        startedAtTurn: base.turnNumber,
        actionType: 'assign' as const,
      },
    };
    const resolved = resolveCurrentTile(game, makeSettings(), new FixedRandomSource([1]));

    expect(resolved.turnPhase).toBe('turn-complete');
    expect(getCurrentPlayer(resolved).drinks).toBe(1);
  });

  it('applies Black Out difficulty pressure to late-game drink assignments', () => {
    const base = makeGame();
    const game = {
      ...base,
      turnPhase: 'resolving-tile' as const,
      currentTileResolution: {
        tileId: 1,
        tileTitle: 'Welcome Sip',
        startedAtTurn: base.turnNumber,
        actionType: 'assign' as const,
      },
      players: base.players.map((player, index) =>
        index === 0 ? { ...player, position: 50 } : player,
      ),
    };
    const resolved = resolveCurrentTile(
      game,
      makeSettings({ difficulty: 'blackout' }),
      new FixedRandomSource([1]),
    );

    expect(getCurrentPlayer(resolved).drinks).toBe(2);
  });

  it('assigns pair choices once to the primary and secondary players', () => {
    const base = makeGame(3);
    const game = {
      ...base,
      turnPhase: 'resolving-tile' as const,
      currentTileResolution: {
        tileId: 30,
        tileTitle: 'Pick a Pair',
        startedAtTurn: base.turnNumber,
        actionType: 'choice' as const,
      },
    };
    const resolved = resolveCurrentTile(game, makeSettings(), new FixedRandomSource([1]), {
      targetPlayerId: base.players[1].id,
      secondaryTargetPlayerId: base.players[2].id,
    });

    expect(resolved.players[0].drinks).toBe(0);
    expect(resolved.players[1].drinks).toBe(1);
    expect(resolved.players[2].drinks).toBe(1);
  });

  it('allows mini-games to resolve with no penalty when cleared', () => {
    const base = makeGame();
    const game = {
      ...base,
      turnPhase: 'resolving-tile' as const,
      currentTileResolution: {
        tileId: 11,
        tileTitle: 'Reaction Tap',
        startedAtTurn: base.turnNumber,
        actionType: 'minigame' as const,
        minigameId: 'reaction-tap' as const,
      },
    };
    const resolved = resolveCurrentTile(game, makeSettings(), new FixedRandomSource([1]), {
      minigameWinnerId: getCurrentPlayer(base).id,
      minigameNoPenalty: true,
    });

    expect(getCurrentPlayer(resolved).drinks).toBe(0);
    expect(getCurrentPlayer(resolved).statistics.minigamesWon).toBe(1);
  });

  it('does not reduce scores below zero', () => {
    const game = applyManualAdjustment(makeGame(), getCurrentPlayer(makeGame()).id, -4, -2);
    const player = getCurrentPlayer(game);

    expect(player.drinks).toBe(0);
    expect(player.shots).toBe(0);
  });

  it('handles empty target lists safely by including the current player when allowed', () => {
    const game = {
      ...makeGame(2),
      players: makeGame(2).players.map((player, index) =>
        index === 1 ? { ...player, finished: true, placement: 1 } : player,
      ),
    };

    expect(getEligibleTargets(game, true)).toHaveLength(1);
    expect(getEligibleTargets(game, false)).toHaveLength(0);
  });

  it('selects spinner segments and calculates a valid final angle', () => {
    const segment = pickSpinnerSegment(new FixedRandomSource([1]));
    const angle = getSpinnerAngle(segment);

    expect(segment).toBe('one-drink');
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(360);
  });

  it('validates and reloads saved games', () => {
    const game = makeGame();
    saveGame(game, DEFAULT_SETTINGS);
    const loaded = loadGame();

    expect(loaded.error).toBeNull();
    expect(loaded.savedGame?.gameState.id).toBe(game.id);
    expect(validateGameState(game).ok).toBe(true);
  });

  it('can restart a turn with the stored pre-roll state', () => {
    const game = makeGame();
    const rolled = rollDice(game, makeSettings(), new FixedRandomSource([3]));
    const restarted = startTurn({
      ...rolled,
      turnPhase: 'awaiting-turn-start',
      turnSnapshot: null,
    });

    expect(restarted.turnPhase).toBe('awaiting-roll');
  });
});
