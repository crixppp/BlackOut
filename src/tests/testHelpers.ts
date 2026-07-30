import { DEFAULT_SETTINGS, type GameSettings, type PlayerDraft } from '../types/game';
import { createNewGame, createPlayerDraft } from '../engine/gameEngine';
import { FixedRandomSource } from '../engine/random';

export function makeDrafts(count = 3): PlayerDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    ...createPlayerDraft(index),
    name: ['Alex', 'Blair', 'Casey', 'Devon', 'Emery'][index] ?? `Player ${index + 1}`,
  }));
}

export function makeSettings(patch: Partial<GameSettings> = {}): GameSettings {
  return {
    ...DEFAULT_SETTINGS,
    randomInitialOrder: false,
    ...patch,
  };
}

export function makeGame(count = 3) {
  return createNewGame(
    makeDrafts(count),
    makeSettings(),
    new FixedRandomSource([1, 2, 3, 4, 5, 6]),
  );
}
