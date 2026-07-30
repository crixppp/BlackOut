import {
  SAVE_SCHEMA_VERSION,
  type GameSettings,
  type GameState,
  type SavedGame,
} from '../types/game';
import { validateGameState } from '../engine/gameEngine';

const SAVE_KEY = 'black-out.saved-game';
const SETTINGS_KEY = 'black-out.settings';
const CORRUPT_SAVE_KEY = 'black-out.corrupt-save';

export interface LoadResult {
  savedGame: SavedGame | null;
  error: string | null;
}

export function saveGame(gameState: GameState, settings: GameSettings): void {
  const payload: SavedGame = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    gameState,
    settings,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function loadGame(): LoadResult {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return { savedGame: null, error: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const validation = validateSavedGame(parsed);
    if (!validation.ok || !validation.savedGame) {
      localStorage.setItem(CORRUPT_SAVE_KEY, raw);
      return {
        savedGame: null,
        error: validation.reason,
      };
    }
    return {
      savedGame: validation.savedGame,
      error: null,
    };
  } catch {
    localStorage.setItem(CORRUPT_SAVE_KEY, raw);
    return {
      savedGame: null,
      error: 'Saved game data could not be read.',
    };
  }
}

export function clearSavedGame(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings<T extends GameSettings>(fallback: T): T {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...fallback,
      ...parsed,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.musicVolume))
          : fallback.musicVolume,
    };
  } catch {
    return fallback;
  }
}

function validateSavedGame(value: unknown): {
  ok: boolean;
  savedGame: SavedGame | null;
  reason: string | null;
} {
  if (!value || typeof value !== 'object') {
    return { ok: false, savedGame: null, reason: 'Saved game is not an object.' };
  }
  const candidate = value as Partial<SavedGame>;
  if (candidate.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return {
      ok: false,
      savedGame: null,
      reason: 'Saved game uses an unsupported version.',
    };
  }
  if (!candidate.gameState || !candidate.settings || typeof candidate.savedAt !== 'string') {
    return {
      ok: false,
      savedGame: null,
      reason: 'Saved game is missing required fields.',
    };
  }
  const gameValidation = validateGameState(candidate.gameState);
  if (!gameValidation.ok) {
    return {
      ok: false,
      savedGame: null,
      reason: gameValidation.errors.join(' '),
    };
  }
  return {
    ok: true,
    savedGame: candidate as SavedGame,
    reason: null,
  };
}
