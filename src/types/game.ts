export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const BOARD_TILE_COUNT = 60;
export const START_POSITION = 0;
export const FINISH_POSITION = BOARD_TILE_COUNT + 1;
export const MAX_CHAINED_MOVES = 3;
export const SAVE_SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 300;

export type ScreenName = 'home' | 'how-to-play' | 'setup' | 'game' | 'results';

export type TurnPhase =
  | 'awaiting-turn-start'
  | 'awaiting-roll'
  | 'rolling'
  | 'moving'
  | 'resolving-tile'
  | 'playing-minigame'
  | 'confirming-result'
  | 'turn-complete'
  | 'game-complete';

export type TileCategory =
  | 'drink'
  | 'shot'
  | 'choice'
  | 'group'
  | 'movement'
  | 'protection'
  | 'random'
  | 'minigame'
  | 'social'
  | 'special'
  | 'recovery';

export type TileActionType =
  | 'assign'
  | 'choice'
  | 'group'
  | 'shield'
  | 'recover'
  | 'movement'
  | 'minigame'
  | 'spinner'
  | 'vote'
  | 'random-outcome'
  | 'buddy'
  | 'card-guess'
  | 'high-roller'
  | 'info';

export type AssignmentTarget =
  'current' | 'chosen' | 'random' | 'previous' | 'everyone' | 'everyoneExceptCurrent';

export interface Assignment {
  target: AssignmentTarget;
  secondary?: boolean;
  autoNext?: boolean;
  drinks?: number;
  shots?: number;
  shields?: number;
  goldenShields?: number;
  removeDrinks?: number;
  removeShots?: number;
}

export interface BoardTile {
  id: number;
  shortLabel: string;
  title: string;
  description: string;
  category: TileCategory;
  icon: string;
  backgroundVariant: string;
  actionType: TileActionType;
  actionConfig?: Record<string, unknown>;
  alcoholFreeText: {
    title: string;
    description: string;
  };
}

export interface PlayerStatistics {
  turnsTaken: number;
  minigamesWon: number;
  minigamesLost: number;
  shieldsUsed: number;
  drinksGiven: number;
  shotsGiven: number;
  largestSingleAssignment: number;
}

export interface PlayerEffect {
  id: string;
  type: 'buddy' | 'bonus-step' | 'safe-next';
  label: string;
  expiresOnTurn: number;
  linkedPlayerId?: string;
}

export interface Player {
  id: string;
  name: string;
  colour: string;
  counterSymbol: string;
  position: number;
  drinks: number;
  shots: number;
  shields: number;
  goldenShields: number;
  finished: boolean;
  placement?: number;
  temporaryEffects: PlayerEffect[];
  statistics: PlayerStatistics;
}

export interface PlayerDraft {
  id: string;
  name: string;
  colour: string;
  counterSymbol: string;
}

export interface Placement {
  playerId: string;
  place: number;
  turnNumber: number;
}

export interface GlobalEffect {
  id: string;
  label: string;
  expiresOnTurn: number;
}

export interface GameEvent {
  id: string;
  turnNumber: number;
  message: string;
  elapsedMs: number;
}

export interface TurnSnapshot {
  gameState: GameState;
  rollValue: number | null;
}

export interface TileResolution {
  tileId: number;
  tileTitle: string;
  startedAtTurn: number;
  actionType: TileActionType;
  minigameId?: MinigameId;
}

export interface PendingRoll {
  value: number;
  from: number;
  target: number;
  path: number[];
  overshotExactFinish: boolean;
}

export interface GameState {
  id: string;
  status: 'setup' | 'active' | 'complete';
  players: Player[];
  currentPlayerIndex: number;
  turnNumber: number;
  turnPhase: TurnPhase;
  placements: Placement[];
  globalEffects: GlobalEffect[];
  currentTileResolution: TileResolution | null;
  pendingRoll: PendingRoll | null;
  chainedMovesThisTurn: number;
  resolvedTileIdsThisTurn: number[];
  history: GameEvent[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  turnSnapshot: TurnSnapshot | null;
}

export interface GameSettings {
  backgroundMusic: boolean;
  musicVolume: number;
  soundEffects: boolean;
  reducedMotion: boolean;
  exactRollToFinish: boolean;
  alcoholFreeMode: boolean;
  difficulty: DifficultyLevel;
  confirmHighShotAssignments: boolean;
  keepScreenAwake: boolean;
  randomInitialOrder: boolean;
  showScoreboard: boolean;
  haptics: boolean;
}

export type DifficultyLevel = 'classic' | 'blackout';

export interface SavedGame {
  schemaVersion: number;
  savedAt: string;
  gameState: GameState;
  settings: GameSettings;
}

export type MinigameId =
  | 'finger-picker'
  | 'spinner'
  | 'categories'
  | 'dice-duel'
  | 'reaction-tap'
  | 'memory-chain'
  | 'number-guess'
  | 'trivia-blitz'
  | 'exact-timer'
  | 'sequence-tap'
  | 'hold-button'
  | 'sorting-sprint'
  | 'bluff-breaker'
  | 'token-toss'
  | 'name-three';

export interface TileChoice {
  targetPlayerId?: string;
  secondaryTargetPlayerId?: string;
  drinks?: number;
  shots?: number;
  shieldUsedByPlayerId?: string;
  minigameWinnerId?: string;
  minigameLoserId?: string;
  minigameNoPenalty?: boolean;
  skip?: boolean;
  spinnerResult?: SpinnerSegmentId;
}

export type SpinnerSegmentId =
  | 'one-drink'
  | 'two-drinks'
  | 'one-shot'
  | 'choose-player'
  | 'all-players'
  | 'shield'
  | 'safe'
  | 'spin-again';

export interface SpinnerSegment {
  id: SpinnerSegmentId;
  label: string;
  weight: number;
  colour: string;
}

export const COUNTER_SYMBOLS = [
  'circle',
  'star',
  'diamond',
  'bolt',
  'hex',
  'moon',
  'sun',
  'cross',
  'heart',
  'flag',
];

export const PLAYER_COLOURS = [
  { name: 'Red', value: '#ff4f5e' },
  { name: 'Blue', value: '#3d8bfd' },
  { name: 'Green', value: '#2fd172' },
  { name: 'Purple', value: '#9b5cff' },
  { name: 'Orange', value: '#ff9f1c' },
  { name: 'Cyan', value: '#2ee6d6' },
  { name: 'Pink', value: '#ff70c8' },
  { name: 'Lime', value: '#b7ff30' },
  { name: 'White', value: '#f7f7f7' },
  { name: 'Yellow', value: '#ffd400' },
];

export const DEFAULT_SETTINGS: GameSettings = {
  backgroundMusic: true,
  musicVolume: 0.35,
  soundEffects: true,
  reducedMotion: false,
  exactRollToFinish: false,
  alcoholFreeMode: false,
  difficulty: 'classic',
  confirmHighShotAssignments: true,
  keepScreenAwake: true,
  randomInitialOrder: true,
  showScoreboard: true,
  haptics: true,
};
