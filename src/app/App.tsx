import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  BadgeHelp,
  BookOpen,
  Brain,
  Check,
  Circle,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  Copy,
  Crown,
  Crosshair,
  CupSoda,
  Dice3,
  Dice5,
  Dice6,
  Dices,
  Disc3,
  Download,
  Drama,
  Droplets,
  Flag,
  Footprints,
  Gift,
  Glasses,
  Hand,
  Handshake,
  Hash,
  HeartHandshake,
  History,
  Home,
  Leaf,
  ListChecks,
  ListPlus,
  Megaphone,
  Menu,
  MousePointer2,
  MousePointerClick,
  PackageOpen,
  PartyPopper,
  Play,
  Plus,
  RefreshCw,
  Rewind,
  RotateCcw,
  RotateCw,
  Rows3,
  Send,
  Shield,
  ShieldCheck,
  ShieldEllipsis,
  ShieldPlus,
  Shuffle,
  SkipForward,
  Snowflake,
  Sparkle,
  Sparkles,
  Split,
  StepBack,
  StepForward,
  Timer,
  TimerReset,
  Trash2,
  Undo2,
  Users,
  UsersRound,
  Volume2,
  VolumeX,
  Vote,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { BOARD_TILES, SPINNER_SEGMENTS, getTileById } from '../data/tiles';
import { CATEGORY_PROMPTS, SORTING_PUZZLES, TRIVIA_QUESTIONS } from '../data/prompts';
import {
  advanceMovementToEnd,
  beginMovement,
  createNewGame,
  createPlayerDraft,
  getCurrentPlayer,
  getEligibleTargets,
  getSpinnerAngle,
  moveToNextTurn,
  pickSpinnerSegment,
  playAgainWithSamePlayers,
  resolveCurrentTile,
  restartTurn,
  rollDice,
  stepMovement,
  validatePlayerDrafts,
} from '../engine/gameEngine';
import { CryptoRandomSource } from '../engine/random';
import { useAudio } from '../hooks/useAudio';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  DEFAULT_SETTINGS,
  FINISH_POSITION,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLOURS,
  type BoardTile,
  type DifficultyLevel,
  type GameSettings,
  type GameState,
  type MinigameId,
  type Player,
  type PlayerDraft,
  type ScreenName,
  type SpinnerSegmentId,
  type TileChoice,
} from '../types/game';
import { compactList, drinkWord, shotWord } from '../utils/text';
import {
  clearSavedGame,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
} from '../services/storage';
import {
  buildResultsText,
  copyResultsToClipboard,
  downloadResultsPng,
} from '../services/resultExport';

const Icons = {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Crosshair,
  Dices,
  Download,
  History,
  Home,
  Leaf,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Rewind,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
};

const ICONS: Record<string, LucideIcon> = {
  ArrowDownAZ,
  BadgeAlert,
  BadgeHelp,
  Brain,
  Circle,
  CircleDollarSign,
  CircleHelp,
  Clock3,
  Copy,
  Crown,
  CupSoda,
  Dice3,
  Dice5,
  Dice6,
  Disc3,
  Drama,
  Droplets,
  Flag,
  Footprints,
  Gift,
  Glasses,
  Hand,
  Handshake,
  Hash,
  HeartHandshake,
  ListChecks,
  ListPlus,
  Megaphone,
  MousePointer2,
  MousePointerClick,
  PackageOpen,
  PartyPopper,
  Rows3,
  Send,
  Shield,
  ShieldCheck,
  ShieldEllipsis,
  ShieldPlus,
  Shuffle,
  Snowflake,
  Sparkle,
  Sparkles,
  Split,
  StepBack,
  StepForward,
  Timer,
  TimerReset,
  Undo2,
  Users,
  UsersRound,
  Volume2,
  Vote,
  WalletCards,
  Zap,
};
const randomSource = new CryptoRandomSource();
const BOARD_PATH_COLUMNS = 10;
const BOARD_PATH_TILE_SIZE = 106;
const BOARD_PATH_X_GAP = 34;
const BOARD_PATH_Y_GAP = 46;
const BOARD_PATH_PADDING = 18;
const BOARD_PATH_ROWS = Math.ceil((FINISH_POSITION + 1) / BOARD_PATH_COLUMNS);
const BOARD_PATH_WIDTH =
  BOARD_PATH_PADDING * 2 +
  BOARD_PATH_COLUMNS * BOARD_PATH_TILE_SIZE +
  (BOARD_PATH_COLUMNS - 1) * BOARD_PATH_X_GAP;
const BOARD_PATH_HEIGHT =
  BOARD_PATH_PADDING * 2 +
  BOARD_PATH_ROWS * BOARD_PATH_TILE_SIZE +
  (BOARD_PATH_ROWS - 1) * BOARD_PATH_Y_GAP;

function Icon({ name, label }: { name: string; label?: string }) {
  const LucideIcon = ICONS[name] ?? ICONS.Circle;
  return <LucideIcon aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function App() {
  const initialSettings = useMemo(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return loadSettings({ ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion });
  }, []);
  const [settings, setSettingsState] = useState<GameSettings>(initialSettings);
  const [screen, setScreen] = useState<ScreenName>('home');
  const [game, setGame] = useState<GameState | null>(null);
  const [savedGameError, setSavedGameError] = useState<string | null>(null);
  const [savedGameAvailable, setSavedGameAvailable] = useState(false);
  const [setupDrafts, setSetupDrafts] = useState<PlayerDraft[]>([
    createPlayerDraft(0),
    createPlayerDraft(1),
  ]);
  const [acknowledgedSafety, setAcknowledgedSafety] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const audio = useAudio(settings, setSettings);
  const wakeLocked = useWakeLock(
    settings.keepScreenAwake,
    screen === 'game' && game?.status === 'active',
  );

  useEffect(() => {
    const loaded = loadGame();
    setSavedGameAvailable(Boolean(loaded.savedGame));
    setSavedGameError(loaded.error);
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (game) {
      saveGame(game, settings);
      setSavedGameAvailable(true);
      if (game.status === 'complete') {
        setScreen('results');
      }
    }
  }, [game, settings]);

  useEffect(() => {
    if (!game || settings.reducedMotion) {
      return;
    }
    if (game.turnPhase === 'rolling') {
      const timeout = window.setTimeout(() => {
        setGame((current) => (current ? beginMovement(current) : current));
      }, 1250);
      return () => window.clearTimeout(timeout);
    }
    if (game.turnPhase === 'moving') {
      const timeout = window.setTimeout(
        () => {
          setGame((current) => (current ? stepMovement(current) : current));
        },
        game.pendingRoll && game.pendingRoll.value > 4 ? 140 : 210,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [game, settings.reducedMotion]);

  useEffect(() => {
    if (!game || !settings.reducedMotion) {
      return;
    }
    if (game.turnPhase === 'rolling' || game.turnPhase === 'moving') {
      setGame(advanceMovementToEnd(game));
    }
  }, [game, settings.reducedMotion]);

  function setSettings(next: GameSettings) {
    setSettingsState(next);
  }

  const beginNewGame = useCallback(() => {
    if (savedGameAvailable) {
      const confirmed = window.confirm(
        'Starting a new game will replace the saved game on this device.',
      );
      if (!confirmed) {
        return;
      }
    }
    setScreen('setup');
  }, [savedGameAvailable]);

  const continueSavedGame = useCallback(() => {
    const loaded = loadGame();
    if (!loaded.savedGame) {
      setSavedGameError(loaded.error ?? 'No saved game was found.');
      setSavedGameAvailable(false);
      return;
    }
    setSettingsState(loaded.savedGame.settings);
    setGame(loaded.savedGame.gameState);
    setScreen(loaded.savedGame.gameState.status === 'complete' ? 'results' : 'game');
  }, []);

  const startGameFromSetup = useCallback(() => {
    const validation = validatePlayerDrafts(setupDrafts);
    if (!validation.ok || !acknowledgedSafety) {
      return;
    }
    const nextGame = createNewGame(setupDrafts, settings, randomSource);
    clearSavedGame();
    setGame(nextGame);
    setSavedGameAvailable(true);
    setScreen('game');
  }, [acknowledgedSafety, settings, setupDrafts]);

  const updateDraft = useCallback((id: string, patch: Partial<PlayerDraft>) => {
    setSetupDrafts((drafts) =>
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }, []);

  const addPlayer = useCallback(() => {
    setSetupDrafts((drafts) =>
      drafts.length >= MAX_PLAYERS ? drafts : [...drafts, createPlayerDraft(drafts.length)],
    );
  }, []);

  const removePlayer = useCallback((id: string) => {
    setSetupDrafts((drafts) =>
      drafts.length <= MIN_PLAYERS ? drafts : drafts.filter((draft) => draft.id !== id),
    );
  }, []);

  const randomiseSetupOrder = useCallback(() => {
    setSetupDrafts((drafts) => randomSource.shuffle(drafts));
  }, []);

  return (
    <div className="app-shell">
      <Header
        screen={screen}
        setScreen={setScreen}
        game={game}
        audio={audio}
        settings={settings}
        setSettings={setSettings}
      />

      {screen === 'home' && (
        <HomeScreen
          onNewGame={beginNewGame}
          onContinue={continueSavedGame}
          onHowToPlay={() => setScreen('how-to-play')}
          savedGameAvailable={savedGameAvailable}
          savedGameError={savedGameError}
          audio={audio}
          settings={settings}
          setSettings={setSettings}
        />
      )}

      {screen === 'how-to-play' && <HowToPlay onBack={() => setScreen('home')} />}

      {screen === 'setup' && (
        <SetupScreen
          drafts={setupDrafts}
          updateDraft={updateDraft}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          randomiseOrder={randomiseSetupOrder}
          settings={settings}
          setSettings={setSettings}
          acknowledgedSafety={acknowledgedSafety}
          setAcknowledgedSafety={setAcknowledgedSafety}
          onStart={startGameFromSetup}
        />
      )}

      {screen === 'game' && game && (
        <GameScreen
          game={game}
          settings={settings}
          setGame={setGame}
          setScreen={setScreen}
          pauseOpen={pauseOpen}
          setPauseOpen={setPauseOpen}
          wakeLocked={wakeLocked}
        />
      )}

      {screen === 'results' && game && (
        <ResultsScreen
          game={game}
          settings={settings}
          onPlayAgain={() => {
            setGame(playAgainWithSamePlayers(game));
            setScreen('game');
          }}
          onNewGame={() => {
            clearSavedGame();
            setGame(null);
            setSavedGameAvailable(false);
            setScreen('setup');
          }}
          onHome={() => setScreen('home')}
        />
      )}
    </div>
  );
}

function Header({
  screen,
  setScreen,
  game,
  audio,
  settings,
  setSettings,
}: {
  screen: ScreenName;
  setScreen: (screen: ScreenName) => void;
  game: GameState | null;
  audio: ReturnType<typeof useAudio>;
  settings: GameSettings;
  setSettings: (settings: GameSettings) => void;
}) {
  return (
    <header className="top-bar">
      <button className="icon-button" type="button" onClick={() => setScreen('home')} title="Home">
        <Icons.Home aria-hidden="true" />
      </button>
      <div className="top-bar__brand">
        <img src="./assets/branding/blackout-logo.png" alt="Black Out!" />
      </div>
      <div className="top-bar__actions">
        {screen === 'game' && game && <span className="turn-pill">Turn {game.turnNumber}</span>}
        <button
          className="icon-button"
          type="button"
          onClick={audio.toggle}
          title={audio.playing ? 'Pause music' : 'Play music'}
        >
          {audio.playing ? (
            <Icons.Volume2 aria-hidden="true" />
          ) : (
            <Icons.VolumeX aria-hidden="true" />
          )}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => setSettings({ ...settings, alcoholFreeMode: !settings.alcoholFreeMode })}
          title={settings.alcoholFreeMode ? 'Party mode' : 'Alcohol-free mode'}
        >
          <Icons.Leaf aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function HomeScreen({
  onNewGame,
  onContinue,
  onHowToPlay,
  savedGameAvailable,
  savedGameError,
  audio,
  settings,
  setSettings,
}: {
  onNewGame: () => void;
  onContinue: () => void;
  onHowToPlay: () => void;
  savedGameAvailable: boolean;
  savedGameError: string | null;
  audio: ReturnType<typeof useAudio>;
  settings: GameSettings;
  setSettings: (settings: GameSettings) => void;
}) {
  return (
    <main className="home-screen screen-band">
      <div className="logo-stage">
        <img src="./assets/branding/blackout-logo.png" alt="Black Out!" />
      </div>
      <section className="home-actions" aria-label="Game actions">
        <button className="primary-button huge" type="button" onClick={onNewGame}>
          <Icons.Plus aria-hidden="true" />
          New Game
        </button>
        {savedGameAvailable && (
          <button className="secondary-button huge" type="button" onClick={onContinue}>
            <Icons.Play aria-hidden="true" />
            Continue Game
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onHowToPlay}>
          <Icons.BookOpen aria-hidden="true" />
          How to Play
        </button>
      </section>
      <section className="settings-strip" aria-label="Quick settings">
        <Toggle
          label="Music"
          checked={settings.backgroundMusic}
          onChange={(checked) => setSettings({ ...settings, backgroundMusic: checked })}
        />
        <label className="range-control">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.musicVolume}
            onChange={(event) => audio.setVolume(Number(event.target.value))}
          />
        </label>
        <Toggle
          label="Alcohol-free"
          checked={settings.alcoholFreeMode}
          onChange={(checked) => setSettings({ ...settings, alcoholFreeMode: checked })}
        />
      </section>
      {savedGameError && (
        <p className="inline-warning" role="status">
          {savedGameError} You can start a fresh game safely.
        </p>
      )}
      {!audio.available && (
        <p className="inline-warning" role="status">
          Music could not be played by this browser, but the game is ready.
        </p>
      )}
      <p className="version-label">Version 1.0.0</p>
    </main>
  );
}

function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <main className="narrow-screen">
      <h1>How to Play</h1>
      <div className="rule-list">
        <p>Add 2 to 10 players, choose counter colours, and start everyone at Start.</p>
        <p>Pass the device around. On each turn, roll the die, move, then resolve the tile.</p>
        <p>Every tile can be confirmed or skipped, and the pause menu can restart the turn.</p>
        <p>
          The first player to reach Finish wins, and the game continues until everyone finishes.
        </p>
        <p>
          Assigned sips and shots are game prompts only. They are not health, safety, or BAC
          measurements.
        </p>
      </div>
      <button className="primary-button" type="button" onClick={onBack}>
        <Icons.ArrowLeft aria-hidden="true" />
        Back Home
      </button>
    </main>
  );
}

function SetupScreen({
  drafts,
  updateDraft,
  addPlayer,
  removePlayer,
  randomiseOrder,
  settings,
  setSettings,
  acknowledgedSafety,
  setAcknowledgedSafety,
  onStart,
}: {
  drafts: PlayerDraft[];
  updateDraft: (id: string, patch: Partial<PlayerDraft>) => void;
  addPlayer: () => void;
  removePlayer: (id: string) => void;
  randomiseOrder: () => void;
  settings: GameSettings;
  setSettings: (settings: GameSettings) => void;
  acknowledgedSafety: boolean;
  setAcknowledgedSafety: (acknowledged: boolean) => void;
  onStart: () => void;
}) {
  const validation = validatePlayerDrafts(drafts);
  const canStart = validation.ok && acknowledgedSafety;

  return (
    <main className="setup-screen">
      <section className="setup-header">
        <img src="./assets/branding/blackout-logo.png" alt="Black Out!" />
        <div>
          <h1>Set Up Game</h1>
          <p>Choose players, colours, and house settings before the board opens.</p>
        </div>
      </section>

      <section className="setup-section">
        <div className="section-title">
          <h2>Players</h2>
          <span>
            {drafts.length}/{MAX_PLAYERS}
          </span>
        </div>
        <div className="player-editor-list">
          {drafts.map((draft, index) => (
            <PlayerEditor
              key={draft.id}
              draft={draft}
              index={index}
              drafts={drafts}
              updateDraft={updateDraft}
              removePlayer={removePlayer}
            />
          ))}
        </div>
        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            onClick={addPlayer}
            disabled={drafts.length >= MAX_PLAYERS}
          >
            <Icons.Plus aria-hidden="true" />
            Add Player
          </button>
          <button className="secondary-button" type="button" onClick={randomiseOrder}>
            <Icons.Shuffle aria-hidden="true" />
            Randomise Order
          </button>
        </div>
        {validation.errors.map((error) => (
          <p className="inline-error" key={error}>
            {error}
          </p>
        ))}
        {validation.warnings.map((warning) => (
          <p className="inline-warning" key={warning}>
            {warning}
          </p>
        ))}
      </section>

      <SettingsPanel settings={settings} setSettings={setSettings} />

      <section className="setup-section safety-panel">
        <h2>Safety Acknowledgement</h2>
        <p>
          This game is intended for adults of legal drinking age. Participation is voluntary, and
          every challenge may be skipped without penalty. Players may replace any drink with water
          or a non-alcoholic drink. Do not drive after drinking. The app counts assigned game scores
          only and does not calculate BAC.
        </p>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={acknowledgedSafety}
            onChange={(event) => setAcknowledgedSafety(event.target.checked)}
          />
          <span>Everyone playing is of legal drinking age, or alcohol-free mode will be used.</span>
        </label>
      </section>

      <button
        className="primary-button sticky-start"
        type="button"
        disabled={!canStart}
        onClick={onStart}
      >
        <Icons.Play aria-hidden="true" />
        Start Game
      </button>
    </main>
  );
}

function PlayerEditor({
  draft,
  index,
  drafts,
  updateDraft,
  removePlayer,
}: {
  draft: PlayerDraft;
  index: number;
  drafts: PlayerDraft[];
  updateDraft: (id: string, patch: Partial<PlayerDraft>) => void;
  removePlayer: (id: string) => void;
}) {
  const usedColours = new Set(
    drafts.filter((entry) => entry.id !== draft.id).map((entry) => entry.colour),
  );

  return (
    <article className="player-editor">
      <div
        className="counter-preview"
        style={{ '--counter-colour': draft.colour } as CSSProperties}
      >
        {index + 1}
      </div>
      <label>
        <span>Name</span>
        <input
          value={draft.name}
          maxLength={20}
          onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
        />
      </label>
      <div className="swatch-grid" role="radiogroup" aria-label={`Colour for player ${index + 1}`}>
        {PLAYER_COLOURS.map((colour) => (
          <button
            key={colour.value}
            className={`swatch ${draft.colour === colour.value ? 'selected' : ''}`}
            type="button"
            disabled={usedColours.has(colour.value)}
            title={colour.name}
            style={{ '--swatch-colour': colour.value } as CSSProperties}
            onClick={() => updateDraft(draft.id, { colour: colour.value })}
          />
        ))}
      </div>
      <button
        className="icon-button"
        type="button"
        title="Remove player"
        onClick={() => removePlayer(draft.id)}
      >
        <Icons.Trash2 aria-hidden="true" />
      </button>
    </article>
  );
}

function SettingsPanel({
  settings,
  setSettings,
}: {
  settings: GameSettings;
  setSettings: (settings: GameSettings) => void;
}) {
  return (
    <section className="setup-section">
      <h2>Settings</h2>
      <div className="settings-grid">
        <Toggle
          label="Background music"
          checked={settings.backgroundMusic}
          onChange={(checked) => setSettings({ ...settings, backgroundMusic: checked })}
        />
        <label className="range-control">
          <span>Music volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.musicVolume}
            onChange={(event) =>
              setSettings({ ...settings, musicVolume: Number(event.target.value) })
            }
          />
        </label>
        <DifficultySelector
          value={settings.difficulty}
          onChange={(difficulty) => setSettings({ ...settings, difficulty })}
        />
        <Toggle
          label="Sound effects"
          checked={settings.soundEffects}
          onChange={(checked) => setSettings({ ...settings, soundEffects: checked })}
        />
        <Toggle
          label="Reduced motion"
          checked={settings.reducedMotion}
          onChange={(checked) => setSettings({ ...settings, reducedMotion: checked })}
        />
        <Toggle
          label="Exact roll to finish"
          checked={settings.exactRollToFinish}
          onChange={(checked) => setSettings({ ...settings, exactRollToFinish: checked })}
        />
        <Toggle
          label="Alcohol-free mode"
          checked={settings.alcoholFreeMode}
          onChange={(checked) => setSettings({ ...settings, alcoholFreeMode: checked })}
        />
        <Toggle
          label="Confirm high shot assignments"
          checked={settings.confirmHighShotAssignments}
          onChange={(checked) => setSettings({ ...settings, confirmHighShotAssignments: checked })}
        />
        <Toggle
          label="Keep screen awake"
          checked={settings.keepScreenAwake}
          onChange={(checked) => setSettings({ ...settings, keepScreenAwake: checked })}
        />
        <Toggle
          label="Random initial order"
          checked={settings.randomInitialOrder}
          onChange={(checked) => setSettings({ ...settings, randomInitialOrder: checked })}
        />
        <Toggle
          label="Show scoreboard"
          checked={settings.showScoreboard}
          onChange={(checked) => setSettings({ ...settings, showScoreboard: checked })}
        />
      </div>
    </section>
  );
}

const difficultyOptions: Array<{
  value: DifficultyLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'classic',
    label: 'Classic',
    description: 'Use the board values exactly as written.',
  },
  {
    value: 'blackout',
    label: 'Black Out',
    description: 'Late-game sip and shot tiles hit harder.',
  },
];

function DifficultySelector({
  value,
  onChange,
}: {
  value: DifficultyLevel;
  onChange: (value: DifficultyLevel) => void;
}) {
  return (
    <fieldset className="difficulty-control">
      <legend>Difficulty</legend>
      <div className="difficulty-options">
        {difficultyOptions.map((option) => (
          <button
            key={option.value}
            className={`difficulty-button ${value === option.value ? 'selected' : ''}`}
            type="button"
            aria-pressed={value === option.value}
            title={option.description}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-line">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function GameScreen({
  game,
  settings,
  setGame,
  setScreen,
  pauseOpen,
  setPauseOpen,
  wakeLocked,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
  setScreen: (screen: ScreenName) => void;
  pauseOpen: boolean;
  setPauseOpen: (open: boolean) => void;
  wakeLocked: boolean;
}) {
  const current = getCurrentPlayer(game);

  return (
    <main className="game-screen">
      <section className="game-status-band">
        <div>
          <p className="eyebrow">Current player</p>
          <h1 style={{ '--player-colour': current.colour } as CSSProperties}>{current.name}</h1>
        </div>
        <div className="status-actions">
          <span className="tiny-status">{wakeLocked ? 'Screen awake' : 'Wake lock optional'}</span>
          <button className="secondary-button" type="button" onClick={() => setPauseOpen(true)}>
            <Icons.Menu aria-hidden="true" />
            Pause
          </button>
        </div>
      </section>

      {settings.showScoreboard && <Scoreboard game={game} settings={settings} compact />}

      <Board game={game} settings={settings} />

      <GameControlDock game={game} settings={settings} setGame={setGame} />
      {game.currentTileResolution && (
        <TileActionModal game={game} settings={settings} setGame={setGame} />
      )}
      {pauseOpen && (
        <PauseMenu
          game={game}
          settings={settings}
          setGame={setGame}
          setScreen={setScreen}
          onClose={() => setPauseOpen(false)}
        />
      )}
    </main>
  );
}

function Board({ game, settings }: { game: GameState; settings: GameSettings }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeTileRef = useRef<HTMLDivElement | null>(null);
  const current = getCurrentPlayer(game);
  const spaces = useMemo(() => {
    return [
      { position: 0, tile: null, label: 'Start' },
      ...BOARD_TILES.map((tile) => ({ position: tile.id, tile, label: tile.shortLabel })),
      { position: FINISH_POSITION, tile: null, label: 'Finish' },
    ];
  }, []);
  const pathSpaces = useMemo(
    () =>
      spaces.map((space) => ({
        ...space,
        point: boardPathPoint(space.position),
      })),
    [spaces],
  );
  const pathLine = useMemo(
    () =>
      pathSpaces
        .map(
          ({ point }) =>
            `${point.x + BOARD_PATH_TILE_SIZE / 2},${point.y + BOARD_PATH_TILE_SIZE / 2}`,
        )
        .join(' '),
    [pathSpaces],
  );

  useEffect(() => {
    if (typeof activeTileRef.current?.scrollIntoView !== 'function') {
      return;
    }

    activeTileRef.current.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: settings.reducedMotion ? 'auto' : 'smooth',
    });
  }, [current.position, settings.reducedMotion]);

  return (
    <section className="board-shell" aria-label="Game board">
      <div className="board-toolbar">
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            activeTileRef.current?.scrollIntoView({
              block: 'center',
              inline: 'center',
              behavior: 'smooth',
            })
          }
        >
          <Icons.Crosshair aria-hidden="true" />
          Find Current Player
        </button>
        <div
          className="mini-map"
          aria-label={`Progress ${Math.round((current.position / FINISH_POSITION) * 100)} percent`}
        >
          <span
            style={{ width: `${Math.min(100, (current.position / FINISH_POSITION) * 100)}%` }}
          />
        </div>
      </div>
      <div className="board-scroll" ref={scrollRef}>
        <div
          className="board-path"
          style={
            {
              '--board-path-width': `${BOARD_PATH_WIDTH}px`,
              '--board-path-height': `${BOARD_PATH_HEIGHT}px`,
            } as CSSProperties
          }
        >
          <svg
            className="board-path-line"
            viewBox={`0 0 ${BOARD_PATH_WIDTH} ${BOARD_PATH_HEIGHT}`}
            aria-hidden="true"
          >
            <polyline points={pathLine} />
          </svg>
          {pathSpaces.map((space) => {
            const playersHere = game.players.filter((player) => player.position === space.position);
            const isActive = current.position === space.position;
            return (
              <BoardSpace
                key={space.position}
                position={space.position}
                tile={space.tile}
                label={space.label}
                point={space.point}
                players={playersHere}
                isActive={isActive}
                refCallback={(node) => {
                  if (isActive) {
                    activeTileRef.current = node;
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BoardSpace({
  position,
  tile,
  label,
  point,
  players,
  isActive,
  refCallback,
}: {
  position: number;
  tile: BoardTile | null;
  label: string;
  point: { x: number; y: number };
  players: Player[];
  isActive: boolean;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={refCallback}
      className={`board-tile variant-${tile?.backgroundVariant ?? (position === 0 ? 'start' : 'finish')} ${isActive ? 'active' : ''}`}
      style={{ left: point.x, top: point.y } as CSSProperties}
    >
      <div className="tile-number">
        {position === 0 ? 'START' : position === FINISH_POSITION ? 'FINISH' : position}
      </div>
      <div className="tile-label">{label}</div>
      {tile && (
        <div className="tile-icon">
          <Icon name={tile.icon} />
        </div>
      )}
      <div className="counter-stack">
        {players.map((player) => (
          <span
            key={player.id}
            className="counter"
            title={player.name}
            style={{ '--counter-colour': player.colour } as CSSProperties}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function boardPathPoint(position: number): { x: number; y: number } {
  const row = Math.floor(position / BOARD_PATH_COLUMNS);
  const rowIndex = position % BOARD_PATH_COLUMNS;
  const column = row % 2 === 0 ? rowIndex : BOARD_PATH_COLUMNS - 1 - rowIndex;
  return {
    x: BOARD_PATH_PADDING + column * (BOARD_PATH_TILE_SIZE + BOARD_PATH_X_GAP),
    y: BOARD_PATH_PADDING + row * (BOARD_PATH_TILE_SIZE + BOARD_PATH_Y_GAP),
  };
}

function Scoreboard({
  game,
  settings,
  compact = false,
}: {
  game: GameState;
  settings: GameSettings;
  compact?: boolean;
}) {
  return (
    <section className={`scoreboard ${compact ? 'compact' : ''}`} aria-label="Scoreboard">
      {game.players.map((player) => (
        <article className={`score-chip ${player.finished ? 'finished' : ''}`} key={player.id}>
          <span
            className="score-dot"
            style={{ '--counter-colour': player.colour } as CSSProperties}
          />
          <strong>{player.name}</strong>
          <span>
            {player.drinks} {drinkWord(player.drinks, settings.alcoholFreeMode)}
          </span>
          <span>
            {player.shots} {shotWord(player.shots, settings.alcoholFreeMode)}
          </span>
          <span>{player.shields + player.goldenShields} shields</span>
          {player.placement && <span>Place {player.placement}</span>}
        </article>
      ))}
    </section>
  );
}

function GameControlDock({
  game,
  settings,
  setGame,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
}) {
  const current = getCurrentPlayer(game);
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (game.pendingRoll) {
      setAnnounced(`${current.name} rolled a ${game.pendingRoll.value}.`);
    }
  }, [current.name, game.pendingRoll]);

  if (game.turnPhase === 'game-complete') {
    return null;
  }

  const rollValue = game.pendingRoll?.value ?? 1;
  const status = rollStatus(game);

  return (
    <section className="game-control-dock" aria-label={`${current.name}'s turn controls`}>
      <div aria-live="polite" className="sr-only">
        {announced}
      </div>
      <div className="dock-player" style={{ '--player-colour': current.colour } as CSSProperties}>
        <span className="dock-counter">{current.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{current.name}</strong>
          <p>
            Space {current.position} · {current.drinks}{' '}
            {drinkWord(current.drinks, settings.alcoholFreeMode)} · {current.shots}{' '}
            {shotWord(current.shots, settings.alcoholFreeMode)}
          </p>
        </div>
      </div>

      <DiceRollIndicator value={rollValue} rolling={game.turnPhase === 'rolling'} />

      <div className="dock-status">
        <strong>{status.title}</strong>
        <span>{status.detail}</span>
      </div>

      <div className="dock-actions">
        {game.turnPhase === 'awaiting-roll' && (
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setGame((state) => (state ? rollDice(state, settings, randomSource) : state))
            }
          >
            <Icons.Dices aria-hidden="true" />
            Roll Dice
          </button>
        )}
        {game.turnPhase === 'rolling' && (
          <button className="primary-button" type="button" disabled>
            <Icons.Dices aria-hidden="true" />
            Rolling
          </button>
        )}
        {game.turnPhase === 'moving' && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setGame((state) => (state ? advanceMovementToEnd(state) : state))}
          >
            <Icons.SkipForward aria-hidden="true" />
            Skip Animation
          </button>
        )}
        {game.turnPhase === 'confirming-result' && (
          <button
            className="primary-button"
            type="button"
            onClick={() => setGame((state) => (state ? moveToNextTurn(state) : state))}
          >
            <Icons.Check aria-hidden="true" />
            End Turn
          </button>
        )}
        {game.turnPhase === 'turn-complete' && (
          <button
            className="primary-button"
            type="button"
            onClick={() => setGame((state) => (state ? moveToNextTurn(state) : state))}
          >
            <Icons.ArrowRight aria-hidden="true" />
            Next Player
          </button>
        )}
      </div>
    </section>
  );
}

function rollStatus(game: GameState): { title: string; detail: string } {
  const current = getCurrentPlayer(game);
  switch (game.turnPhase) {
    case 'awaiting-roll':
      return { title: 'Ready', detail: 'Roll when everyone can see the board.' };
    case 'rolling':
      return { title: 'Shaking...', detail: 'Result is hidden until the dice settle.' };
    case 'moving':
      return {
        title: `Rolled ${game.pendingRoll?.value ?? 0}`,
        detail: `Moving toward space ${game.pendingRoll?.target ?? current.position}.`,
      };
    case 'resolving-tile':
      return { title: 'Tile landed', detail: 'Resolve the space, then pass the device.' };
    case 'confirming-result':
      return {
        title: 'Exact roll missed',
        detail: `${current.name} stays on space ${current.position}.`,
      };
    case 'turn-complete':
      return { title: 'Turn complete', detail: 'Pass to the next player.' };
    default:
      return { title: 'In progress', detail: `Turn ${game.turnNumber}` };
  }
}

const dicePips: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function DiceRollIndicator({ value, rolling }: { value: number; rolling: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!rolling) {
      setDisplayValue(value);
      return;
    }
    const interval = window.setInterval(() => {
      setDisplayValue((face) => (face % 6) + 1);
    }, 86);
    return () => window.clearInterval(interval);
  }, [rolling, value]);

  return (
    <div
      className={`dice-mini ${rolling ? 'rolling' : ''}`}
      role="img"
      aria-label={rolling ? 'Dice rolling' : `Dice face ${value}`}
    >
      {Array.from({ length: 9 }, (_, index) => {
        const pipIndex = index + 1;
        const active = dicePips[displayValue]?.includes(pipIndex);
        return <span key={pipIndex} className={active ? 'pip active' : 'pip'} />;
      })}
    </div>
  );
}

function TileActionModal({
  game,
  settings,
  setGame,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
}) {
  const resolution = game.currentTileResolution;
  const tile = resolution ? getTileById(resolution.tileId) : undefined;
  const current = getCurrentPlayer(game);
  const [targetId, setTargetId] = useState(
    () => getEligibleTargets(game, true)[0]?.id ?? current.id,
  );
  const [secondaryTargetId, setSecondaryTargetId] = useState<string | undefined>();
  const [shieldTargetId, setShieldTargetId] = useState<string | undefined>();
  const [spinnerResult, setSpinnerResult] = useState<SpinnerSegmentId | undefined>();
  const [minigameLoserId, setMinigameLoserId] = useState<string | undefined>();
  const [minigameWinnerId, setMinigameWinnerId] = useState<string | undefined>();
  const [minigameNoPenalty, setMinigameNoPenalty] = useState(false);
  const [revealReady, setRevealReady] = useState(settings.reducedMotion);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const actionSubmittedRef = useRef(false);
  const targetIncludesCurrent =
    !tile || (tile.actionType !== 'choice' && tile.actionType !== 'buddy')
      ? true
      : tile.actionConfig?.allowSelf !== false;
  const targets = useMemo(
    () => getEligibleTargets(game, targetIncludesCurrent),
    [game, targetIncludesCurrent],
  );
  const secondaryTargets = targets.filter((player) => player.id !== targetId);

  useEffect(() => {
    if (targets.length > 0 && !targets.some((player) => player.id === targetId)) {
      setTargetId(targets[0].id);
    }
  }, [targetId, targets]);

  useEffect(() => {
    setChallengeStarted(false);
    setRevealReady(settings.reducedMotion);
    if (settings.reducedMotion) {
      return;
    }
    const timeout = window.setTimeout(() => setRevealReady(true), 700);
    return () => window.clearTimeout(timeout);
  }, [resolution?.startedAtTurn, resolution?.tileId, settings.reducedMotion]);

  if (!tile) {
    return null;
  }

  const display = settings.alcoholFreeMode ? tile.alcoholFreeText : tile;
  const selectedPlayer = game.players.find((player) => player.id === targetId) ?? targets[0];
  const canUseShield =
    selectedPlayer && (selectedPlayer.shields > 0 || selectedPlayer.goldenShields > 0);
  const isMinigame = tile.actionType === 'minigame';
  const isSpinner = tile.actionType === 'spinner';

  const resolve = (extra: TileChoice = {}) => {
    if (actionSubmittedRef.current) {
      return;
    }
    actionSubmittedRef.current = true;
    const effectiveSecondaryTargetId =
      tile.id === 30 ? (secondaryTargetId ?? secondaryTargets[0]?.id) : secondaryTargetId;
    const choice: TileChoice = {
      targetPlayerId: targetId,
      secondaryTargetPlayerId: effectiveSecondaryTargetId,
      shieldUsedByPlayerId: shieldTargetId,
      spinnerResult,
      minigameLoserId,
      minigameWinnerId,
      minigameNoPenalty,
      ...extra,
    };
    setGame((state) => (state ? resolveCurrentTile(state, settings, randomSource, choice) : state));
  };

  const submitResult = (extra: TileChoice = {}) => {
    resolve(extra);
  };

  if (!revealReady) {
    return null;
  }

  if (!challengeStarted) {
    return (
      <Modal title={display.title} className="tile-modal reveal-modal">
        <div className={`tile-banner variant-${tile.backgroundVariant}`}>
          <Icon name={tile.icon} />
          <div>
            <p className="eyebrow">Space {tile.id}</p>
            <h2>{display.title}</h2>
          </div>
        </div>
        <div className="challenge-reveal-card">
          <span>{tile.actionType === 'minigame' ? 'Challenge' : 'Tile'}</span>
          <p>{display.description}</p>
        </div>
        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => submitResult({ skip: true })}
          >
            <Icons.SkipForward aria-hidden="true" />
            Skip
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setChallengeStarted(true)}
          >
            <Icons.Play aria-hidden="true" />
            Start Challenge
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={display.title} className="tile-modal">
      <div className={`tile-banner variant-${tile.backgroundVariant}`}>
        <Icon name={tile.icon} />
        <div>
          <p className="eyebrow">Space {tile.id}</p>
          <h2>{display.title}</h2>
        </div>
      </div>
      <p className="tile-description">{display.description}</p>

      {(tile.actionType === 'choice' ||
        tile.actionType === 'vote' ||
        tile.actionType === 'card-guess' ||
        tile.actionType === 'high-roller' ||
        tile.actionType === 'random-outcome') && (
        <PlayerSelect
          label="Selected player"
          players={targets}
          value={targetId}
          onChange={setTargetId}
        />
      )}

      {tile.id === 30 && (
        <PlayerSelect
          label="Second selected player"
          players={secondaryTargets.length > 0 ? secondaryTargets : targets}
          value={secondaryTargetId ?? secondaryTargets[0]?.id ?? targetId}
          onChange={setSecondaryTargetId}
        />
      )}

      {isSpinner && (
        <SpinnerPanel
          result={spinnerResult}
          onSpin={() => setSpinnerResult(pickSpinnerSegment(randomSource))}
        />
      )}

      {isMinigame && (
        <MinigamePanel
          key={`${tile.id}-${resolution?.startedAtTurn ?? game.turnNumber}`}
          id={String(tile.actionConfig?.minigameId) as MinigameId}
          game={game}
          settings={settings}
          loserId={minigameLoserId}
          winnerId={minigameWinnerId}
          setLoserId={setMinigameLoserId}
          setWinnerId={setMinigameWinnerId}
          noPenalty={minigameNoPenalty}
          setNoPenalty={setMinigameNoPenalty}
        />
      )}

      {canUseShield && (
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={shieldTargetId === selectedPlayer.id}
            onChange={(event) =>
              setShieldTargetId(event.target.checked ? selectedPlayer.id : undefined)
            }
          />
          <span>Use {selectedPlayer.name}'s Shield if this assignment allows it</span>
        </label>
      )}

      <div className="modal-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => submitResult({ skip: true })}
        >
          <Icons.SkipForward aria-hidden="true" />
          Skip
        </button>
        <button className="primary-button" type="button" onClick={() => submitResult()}>
          <Icons.Check aria-hidden="true" />
          Confirm Result
        </button>
      </div>
    </Modal>
  );
}

function PlayerSelect({
  label,
  players,
  value,
  onChange,
}: {
  label: string;
  players: Player[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SpinnerPanel({ result, onSpin }: { result?: SpinnerSegmentId; onSpin: () => void }) {
  const angle = result ? getSpinnerAngle(result) + 1440 : 0;
  const label = SPINNER_SEGMENTS.find((segment) => segment.id === result)?.label ?? 'Ready';
  return (
    <div className="spinner-panel">
      <div className="spinner-wheel" style={{ transform: `rotate(${angle}deg)` }}>
        {SPINNER_SEGMENTS.map((segment, index) => (
          <span
            key={segment.id}
            style={
              {
                '--segment-colour': segment.colour,
                '--segment-index': index,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={onSpin}>
        <Icons.RotateCw aria-hidden="true" />
        Spin
      </button>
      <strong>{label}</strong>
    </div>
  );
}

function MinigamePanel({
  id,
  game,
  settings,
  loserId,
  winnerId,
  setLoserId,
  setWinnerId,
  noPenalty,
  setNoPenalty,
}: {
  id: MinigameId;
  game: GameState;
  settings: GameSettings;
  loserId?: string;
  winnerId?: string;
  setLoserId: (id: string | undefined) => void;
  setWinnerId: (id: string | undefined) => void;
  noPenalty: boolean;
  setNoPenalty: (value: boolean) => void;
}) {
  const players = getEligibleTargets(game, true);
  const current = getCurrentPlayer(game);
  const [touches, setTouches] = useState<Map<number, string>>(new Map());
  const [numberTarget] = useState(() => randomSource.integer(1, 20));
  const [guess, setGuess] = useState('');
  const [guessAttempts, setGuessAttempts] = useState(0);
  const [guessMessage, setGuessMessage] = useState('Three guesses. Correct clears the penalty.');
  const [prompt] = useState(() => randomSource.pick(CATEGORY_PROMPTS));
  const [trivia] = useState(() => randomSource.pick(TRIVIA_QUESTIONS));
  const [sorting] = useState(() => randomSource.pick(SORTING_PUZZLES));

  const selectedLoser = loserId ?? players[0]?.id;
  const selectedWinner = winnerId ?? current.id;

  const pickRandomLoser = () => {
    setNoPenalty(false);
    setLoserId(randomSource.pick(players).id);
  };

  const markLoser = (id: string | undefined) => {
    setNoPenalty(false);
    setLoserId(id);
  };

  const markNoPenalty = (winner: string | undefined = current.id) => {
    setWinnerId(winner);
    setLoserId(undefined);
    setNoPenalty(true);
  };

  const submitGuess = () => {
    const value = Number(guess);
    if (!Number.isFinite(value)) {
      setGuessMessage('Enter a number first.');
      return;
    }
    if (value === numberTarget) {
      setGuessMessage('Correct. No penalty is selected.');
      markNoPenalty(current.id);
      return;
    }
    const nextAttempt = guessAttempts + 1;
    setGuessAttempts(nextAttempt);
    if (nextAttempt >= 3) {
      setGuessMessage(`Missed. The number was ${numberTarget}.`);
      markLoser(current.id);
      return;
    }
    setGuessMessage(`${value < numberTarget ? 'Higher' : 'Lower'}. Guess ${nextAttempt + 1} of 3.`);
  };

  return (
    <section className="minigame-panel" aria-label="Minigame controls">
      <div className="minigame-title">
        <Icon name={minigameIcon(id)} />
        <h3>{minigameTitle(id)}</h3>
      </div>

      {id === 'finger-picker' && (
        <div
          className="touch-pad"
          onPointerDown={(event) => {
            if (event.target instanceof HTMLElement && event.target.closest('button')) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            setTouches((currentTouches) =>
              new Map(currentTouches).set(event.pointerId, `Touch ${currentTouches.size + 1}`),
            );
          }}
          onPointerUp={(event) => {
            setTouches((currentTouches) => {
              const next = new Map(currentTouches);
              next.delete(event.pointerId);
              return next;
            });
          }}
        >
          <strong>Place fingers here</strong>
          <span>
            {touches.size} active touch{touches.size === 1 ? '' : 'es'}
          </span>
          <button className="secondary-button" type="button" onClick={pickRandomLoser}>
            Fallback picker
          </button>
        </div>
      )}

      {id === 'categories' && (
        <p>
          Category: <strong>{prompt}</strong>. Answer around the room until someone misses.
        </p>
      )}
      {id === 'name-three' && (
        <p>
          Name three from <strong>{prompt}</strong> in five seconds.
        </p>
      )}
      {id === 'dice-duel' && (
        <DiceDuelMini
          current={current}
          players={players}
          setLoserId={markLoser}
          setWinnerId={setWinnerId}
        />
      )}
      {id === 'reaction-tap' && (
        <ReactionTapMini setLoserId={markLoser} setWinnerId={setWinnerId} players={players} />
      )}
      {id === 'colour-rush' && (
        <ColourRushMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'blackjack' && (
        <BlackjackMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'wire-cutter' && (
        <WireCutterMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'lock-picker' && (
        <LockPickerMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'bomb-defuse' && (
        <BombDefuseMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'memory-chain' && (
        <p>
          Build a chain from the category <strong>{prompt}</strong>. Mark the first miss below.
        </p>
      )}
      {id === 'number-guess' && (
        <div className="guess-row">
          <input
            inputMode="numeric"
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            placeholder="1-20"
          />
          <button className="secondary-button" type="button" onClick={submitGuess}>
            Guess
          </button>
          <span>{guessMessage}</span>
        </div>
      )}
      {id === 'trivia-blitz' && (
        <details>
          <summary>{trivia.question}</summary>
          <p>Answer: {trivia.answer}</p>
        </details>
      )}
      {id === 'exact-timer' && (
        <TimerMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'sequence-tap' && (
        <SequenceMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'hold-button' && (
        <HoldButtonMini current={current} setLoserId={markLoser} markNoPenalty={markNoPenalty} />
      )}
      {id === 'sorting-sprint' && (
        <p>
          {sorting.prompt} {compactList(sorting.items)}
        </p>
      )}
      {id === 'bluff-breaker' && (
        <p>Current player gives two real clues and one bluff. Group guesses the odd one out.</p>
      )}
      {id === 'token-toss' && (
        <p>Each player picks a token value. Lowest token receives the assignment.</p>
      )}
      {id === 'spinner' && <p>Use the spinner controls above.</p>}

      <div className="minigame-outcome">
        <PlayerSelect
          label="Winner"
          players={players}
          value={selectedWinner}
          onChange={setWinnerId}
        />
        <PlayerSelect
          label={`Receives ${drinkWord(1, settings.alcoholFreeMode)}`}
          players={players}
          value={selectedLoser}
          onChange={markLoser}
        />
      </div>
      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={noPenalty}
          onChange={(event) => {
            setNoPenalty(event.target.checked);
            if (event.target.checked) {
              setLoserId(undefined);
            }
          }}
        />
        <span>No penalty for this mini-game</span>
      </label>
    </section>
  );
}

function DiceDuelMini({
  current,
  players,
  setLoserId,
  setWinnerId,
}: {
  current: Player;
  players: Player[];
  setLoserId: (id: string | undefined) => void;
  setWinnerId: (id: string | undefined) => void;
}) {
  const opponents = players.filter((player) => player.id !== current.id);
  const [opponentId, setOpponentId] = useState(opponents[0]?.id ?? current.id);
  const [result, setResult] = useState('Choose an opponent, then roll both dice.');

  const rollDuel = () => {
    const opponent = players.find((player) => player.id === opponentId) ?? opponents[0];
    if (!opponent) {
      setResult('No opponent is available.');
      return;
    }
    const currentRoll = randomSource.integer(1, 6);
    const opponentRoll = randomSource.integer(1, 6);
    if (currentRoll === opponentRoll) {
      setResult(
        `${current.name} ${currentRoll} · ${opponent.name} ${opponentRoll}. Tie, roll again.`,
      );
      return;
    }
    const loser = currentRoll < opponentRoll ? current : opponent;
    const winner = currentRoll > opponentRoll ? current : opponent;
    setLoserId(loser.id);
    setWinnerId(winner.id);
    setResult(
      `${current.name} ${currentRoll} · ${opponent.name} ${opponentRoll}. ${loser.name} loses.`,
    );
  };

  return (
    <div className="mini-card">
      <PlayerSelect
        label="Opponent"
        players={opponents.length > 0 ? opponents : players}
        value={opponentId}
        onChange={setOpponentId}
      />
      <button className="secondary-button" type="button" onClick={rollDuel}>
        <Icons.Dices aria-hidden="true" />
        Roll Duel
      </button>
      <span>{result}</span>
    </div>
  );
}

function ReactionTapMini({
  players,
  setLoserId,
  setWinnerId,
}: {
  players: Player[];
  setLoserId: (id: string | undefined) => void;
  setWinnerId: (id: string | undefined) => void;
}) {
  const [state, setState] = useState<'idle' | 'waiting' | 'tap' | 'done'>('idle');
  const [message, setMessage] = useState(
    'Start the round, then tap only when the screen turns yellow.',
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tapTimes, setTapTimes] = useState<Record<string, number>>({});
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const start = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setState('waiting');
    setTapTimes({});
    setStartedAt(null);
    setMessage('Wait for yellow...');
    timeoutRef.current = window.setTimeout(
      () => {
        setState('tap');
        setStartedAt(performance.now());
        setMessage('TAP');
      },
      randomSource.integer(900, 2400),
    );
  };

  const registerTap = (player: Player) => {
    if (state === 'waiting') {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      setState('done');
      setLoserId(player.id);
      setMessage(`${player.name} tapped early.`);
      return;
    }
    if (state !== 'tap' || !startedAt || tapTimes[player.id] !== undefined) {
      return;
    }

    const elapsed = performance.now() - startedAt;
    const nextTimes = { ...tapTimes, [player.id]: elapsed };
    setTapTimes(nextTimes);

    const entries = Object.entries(nextTimes);
    if (entries.length >= players.length) {
      const sorted = entries.sort((a, b) => a[1] - b[1]);
      const winner = players.find((entry) => entry.id === sorted[0][0]);
      const loser = players.find((entry) => entry.id === sorted[sorted.length - 1][0]);
      setWinnerId(winner?.id);
      setLoserId(loser?.id);
      setState('done');
      setMessage(`${winner?.name ?? 'Fastest'} fastest · ${loser?.name ?? 'Slowest'} slowest.`);
      return;
    }

    setMessage(`${player.name} locked in. ${players.length - entries.length} to go.`);
  };

  return (
    <div className={`reaction-zone ${state}`}>
      <strong>{message}</strong>
      <div className="reaction-player-grid">
        {players.map((player) => (
          <button
            key={player.id}
            className={
              tapTimes[player.id] !== undefined ? 'reaction-player tapped' : 'reaction-player'
            }
            type="button"
            style={{ '--counter-colour': player.colour } as CSSProperties}
            disabled={state === 'idle' || state === 'done'}
            onClick={() => registerTap(player)}
          >
            {player.name}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={start}>
          {state === 'idle' ? 'Start' : 'Restart'}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setLoserId(randomSource.pick(players).id)}
        >
          Mark slowest
        </button>
      </div>
    </div>
  );
}

const rushColours = [
  { id: 'red', label: 'Red', value: '#ff7b7f' },
  { id: 'yellow', label: 'Yellow', value: '#ffd400' },
  { id: 'cyan', label: 'Cyan', value: '#2ee6d6' },
  { id: 'green', label: 'Green', value: '#a6f4b8' },
] as const;

function ColourRushMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [word] = useState(() => randomSource.pick(rushColours));
  const [ink] = useState(() => {
    const options = rushColours.filter((colour) => colour.id !== word.id);
    return randomSource.pick(options);
  });
  const [message, setMessage] = useState('Tap the colour of the text, not the word.');
  const [locked, setLocked] = useState(false);

  const choose = (colourId: string) => {
    if (locked) {
      return;
    }
    setLocked(true);
    if (colourId === ink.id) {
      markNoPenalty(current.id);
      setMessage('Correct. Penalty cleared.');
      return;
    }
    setLoserId(current.id);
    setMessage(`${current.name} picked the word instead of the colour.`);
  };

  return (
    <div className="mini-card colour-rush-card">
      <strong style={{ color: ink.value }}>{word.label}</strong>
      <div className="colour-choice-grid">
        {rushColours.map((colour) => (
          <button
            key={colour.id}
            className="colour-choice"
            type="button"
            disabled={locked}
            style={{ '--choice-colour': colour.value } as CSSProperties}
            onClick={() => choose(colour.id)}
          >
            {colour.label}
          </button>
        ))}
      </div>
      <span>{message}</span>
    </div>
  );
}

function drawBlackjackCard(): number {
  const raw = randomSource.integer(1, 13);
  return raw > 10 ? 10 : raw;
}

function blackjackTotal(cards: number[]): number {
  let total = cards.reduce((sum, card) => sum + (card === 1 ? 11 : card), 0);
  let aces = cards.filter((card) => card === 1).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function BlackjackMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [playerCards, setPlayerCards] = useState(() => [drawBlackjackCard(), drawBlackjackCard()]);
  const [dealerCards, setDealerCards] = useState(() => [drawBlackjackCard(), drawBlackjackCard()]);
  const [message, setMessage] = useState('Hit or stand. Beat the dealer without busting.');
  const [locked, setLocked] = useState(false);
  const playerTotal = blackjackTotal(playerCards);
  const dealerTotal = blackjackTotal(dealerCards);

  const lose = (text: string) => {
    setLocked(true);
    setLoserId(current.id);
    setMessage(text);
  };

  const win = (text: string) => {
    setLocked(true);
    markNoPenalty(current.id);
    setMessage(text);
  };

  const hit = () => {
    const nextCards = [...playerCards, drawBlackjackCard()];
    setPlayerCards(nextCards);
    const nextTotal = blackjackTotal(nextCards);
    if (nextTotal > 21) {
      lose(`${current.name} busted at ${nextTotal}.`);
    }
  };

  const stand = () => {
    const nextDealerCards = [...dealerCards];
    while (blackjackTotal(nextDealerCards) < 17) {
      nextDealerCards.push(drawBlackjackCard());
    }
    setDealerCards(nextDealerCards);
    const finalDealer = blackjackTotal(nextDealerCards);
    if (finalDealer > 21 || playerTotal > finalDealer) {
      win(`${current.name} ${playerTotal} beats dealer ${finalDealer}.`);
      return;
    }
    if (playerTotal === finalDealer) {
      win(`Push at ${playerTotal}. No penalty.`);
      return;
    }
    lose(`Dealer ${finalDealer} beats ${current.name} ${playerTotal}.`);
  };

  return (
    <div className="mini-card blackjack-card">
      <div className="blackjack-hands">
        <span>
          {current.name}: {playerCards.join(' + ')} = <strong>{playerTotal}</strong>
        </span>
        <span>
          Dealer: {dealerCards.join(' + ')} = <strong>{dealerTotal}</strong>
        </span>
      </div>
      <div className="button-row">
        <button className="secondary-button" type="button" disabled={locked} onClick={hit}>
          Hit
        </button>
        <button className="secondary-button" type="button" disabled={locked} onClick={stand}>
          Stand
        </button>
      </div>
      <span>{message}</span>
    </div>
  );
}

function WireCutterMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [correctWire] = useState(() => randomSource.pick(rushColours));
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('Start the countdown, then cut the wire from the clue.');

  useEffect(() => {
    if (!armed || done) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setDone(true);
      setLoserId(current.id);
      setMessage('Time ran out.');
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [armed, current.id, done, setLoserId]);

  const cut = (wireId: string) => {
    if (!armed || done) {
      return;
    }
    setDone(true);
    if (wireId === correctWire.id) {
      markNoPenalty(current.id);
      setMessage('Correct wire cut.');
      return;
    }
    setLoserId(current.id);
    setMessage('Wrong wire.');
  };

  return (
    <div className="mini-card wire-card">
      <strong>Clue: cut the {correctWire.label.toLowerCase()} wire.</strong>
      <div className="wire-grid">
        {rushColours.map((wire) => (
          <button
            key={wire.id}
            className="wire-button"
            type="button"
            disabled={!armed || done}
            style={{ '--choice-colour': wire.value } as CSSProperties}
            onClick={() => cut(wire.id)}
          >
            {wire.label}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          type="button"
          disabled={armed && !done}
          onClick={() => {
            setArmed(true);
            setDone(false);
            setMessage('Countdown running.');
          }}
        >
          Start Countdown
        </button>
        <span>{message}</span>
      </div>
    </div>
  );
}

function LockPickerMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [message, setMessage] = useState('Start the lock, then stop the marker in the gold zone.');
  const [locked, setLocked] = useState(false);
  const cycleMs = 1500;

  const stop = () => {
    if (!running || !startedAt || locked) {
      return;
    }
    const elapsed = performance.now() - startedAt;
    const angle = ((elapsed % cycleMs) / cycleMs) * 360;
    const hit = angle >= 320 || angle <= 38;
    setRunning(false);
    setLocked(true);
    if (hit) {
      markNoPenalty(current.id);
      setMessage(`Unlocked at ${Math.round(angle)} degrees.`);
      return;
    }
    setLoserId(current.id);
    setMessage(`Missed at ${Math.round(angle)} degrees.`);
  };

  return (
    <div className="mini-card lock-card">
      <div className={`lock-face ${running ? 'running' : ''}`} aria-label="Lock picker target">
        <span className="lock-success-zone" />
        <span className="lock-marker" />
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          type="button"
          disabled={running || locked}
          onClick={() => {
            setRunning(true);
            setStartedAt(performance.now());
            setMessage('Marker moving.');
          }}
        >
          Start Lock
        </button>
        <button className="secondary-button" type="button" disabled={!running} onClick={stop}>
          Stop Marker
        </button>
      </div>
      <span>{message}</span>
    </div>
  );
}

function BombDefuseMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [targetButton] = useState(() => randomSource.integer(1, 3));
  const [code] = useState(() => String(randomSource.integer(100, 999)));
  const [correctWire] = useState(() => randomSource.pick(rushColours));
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [codeGuess, setCodeGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(14);
  const [message, setMessage] = useState('Start the bomb, then clear all three tasks.');

  useEffect(() => {
    if (!started || done) {
      return;
    }
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setTimeLeft(Math.max(0, 14 - Math.floor((performance.now() - startedAt) / 1000)));
    }, 250);
    const timeout = window.setTimeout(() => {
      setDone(true);
      setLoserId(current.id);
      setMessage('Bomb timer expired.');
    }, 14000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [current.id, done, setLoserId, started]);

  const fail = (text: string) => {
    setDone(true);
    setLoserId(current.id);
    setMessage(text);
  };

  const advance = () => {
    if (step >= 2) {
      setDone(true);
      markNoPenalty(current.id);
      setMessage('Bomb defused.');
      return;
    }
    setStep((value) => value + 1);
    setMessage('Good. Next task.');
  };

  return (
    <div className="mini-card bomb-card">
      <div className="bomb-status">
        <strong>{started ? `${timeLeft}s` : 'Ready'}</strong>
        <span>{message}</span>
      </div>
      {!started && (
        <button className="secondary-button" type="button" onClick={() => setStarted(true)}>
          Start Bomb
        </button>
      )}
      {started && step === 0 && (
        <div className="bomb-task">
          <strong>Press Button {targetButton}.</strong>
          <div className="button-row">
            {[1, 2, 3].map((number) => (
              <button
                key={number}
                className="secondary-button"
                type="button"
                disabled={done}
                onClick={() => (number === targetButton ? advance() : fail('Wrong button.'))}
              >
                Button {number}
              </button>
            ))}
          </div>
        </div>
      )}
      {started && step === 1 && (
        <div className="guess-row">
          <input value={codeGuess} onChange={(event) => setCodeGuess(event.target.value)} />
          <button
            className="secondary-button"
            type="button"
            disabled={done}
            onClick={() => (codeGuess === code ? advance() : fail('Wrong code.'))}
          >
            Enter Code
          </button>
          <span>Code: {code}</span>
        </div>
      )}
      {started && step === 2 && (
        <div className="wire-grid">
          {rushColours.map((wire) => (
            <button
              key={wire.id}
              className="wire-button"
              type="button"
              disabled={done}
              style={{ '--choice-colour': wire.value } as CSSProperties}
              onClick={() => (wire.id === correctWire.id ? advance() : fail('Wrong wire.'))}
            >
              {wire.label}
            </button>
          ))}
          <span>Cut {correctWire.label.toLowerCase()}.</span>
        </div>
      )}
    </div>
  );
}

function TimerMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState('Target is 7.00 seconds.');
  const targetSeconds = 7;
  const tolerance = 0.45;
  return (
    <div className="button-row">
      <button
        className="secondary-button"
        type="button"
        onClick={() => {
          setRunning(true);
          setStartedAt(performance.now());
          setResult('Counting...');
        }}
      >
        Start
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={!running || !startedAt}
        onClick={() => {
          const elapsed = startedAt ? (performance.now() - startedAt) / 1000 : 0;
          const difference = Math.abs(elapsed - targetSeconds);
          setRunning(false);
          if (difference <= tolerance) {
            markNoPenalty(current.id);
            setResult(`${elapsed.toFixed(2)} seconds. Cleared.`);
            return;
          }
          setLoserId(current.id);
          setResult(`${elapsed.toFixed(2)} seconds. ${current.name} missed.`);
        }}
      >
        Stop
      </button>
      <span>{result}</span>
    </div>
  );
}

function SequenceMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const sequence = useMemo(
    () => ['yellow', 'white', 'red', 'cyan'].slice(0, randomSource.integer(3, 4)),
    [],
  );
  const [cursor, setCursor] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('Tap the colours in order.');
  const colours = ['yellow', 'white', 'red', 'cyan'];
  const tapColour = (colour: string) => {
    if (locked) {
      return;
    }
    if (colour !== sequence[cursor]) {
      setLocked(true);
      setLoserId(current.id);
      setMessage(`${current.name} missed the sequence.`);
      return;
    }
    if (cursor + 1 >= sequence.length) {
      setLocked(true);
      markNoPenalty(current.id);
      setMessage('Sequence cleared.');
      return;
    }
    setCursor((value) => value + 1);
    setMessage(`Good. ${sequence.length - cursor - 1} left.`);
  };

  return (
    <div className="mini-card">
      <div className="sequence-row" aria-label="Target sequence">
        {sequence.map((colour, index) => (
          <span key={`${colour}-${index}`} className={`sequence-dot ${colour}`}>
            {index + 1}
          </span>
        ))}
      </div>
      <div className="sequence-row" aria-label="Sequence controls">
        {colours.map((colour) => (
          <button
            key={colour}
            className={`sequence-dot ${colour}`}
            type="button"
            disabled={locked}
            onClick={() => tapColour(colour)}
          >
            {colour.slice(0, 1).toUpperCase()}
          </button>
        ))}
      </div>
      <span>{message}</span>
    </div>
  );
}

function HoldButtonMini({
  current,
  setLoserId,
  markNoPenalty,
}: {
  current: Player;
  setLoserId: (id: string | undefined) => void;
  markNoPenalty: (winner?: string | undefined) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [label, setLabel] = useState('Hold, then release near 3 seconds.');
  const targetSeconds = 3;
  const tolerance = 0.35;
  return (
    <button
      className={`hold-button ${holding ? 'holding' : ''}`}
      type="button"
      onPointerDown={() => {
        setHolding(true);
        setStartedAt(performance.now());
        setLabel('Holding...');
      }}
      onPointerUp={() => {
        const elapsed = startedAt ? (performance.now() - startedAt) / 1000 : 0;
        const difference = Math.abs(elapsed - targetSeconds);
        setHolding(false);
        if (difference <= tolerance) {
          markNoPenalty(current.id);
          setLabel(`${elapsed.toFixed(2)} seconds. Cleared.`);
          return;
        }
        setLoserId(current.id);
        setLabel(`${elapsed.toFixed(2)} seconds. Missed.`);
      }}
      onPointerCancel={() => {
        setHolding(false);
        setLabel('Hold cancelled.');
      }}
    >
      {label}
    </button>
  );
}

function minigameTitle(id: MinigameId): string {
  return id
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function minigameIcon(id: MinigameId): string {
  const map: Record<MinigameId, string> = {
    'finger-picker': 'Hand',
    spinner: 'Disc3',
    categories: 'ListChecks',
    'dice-duel': 'Dice5',
    'reaction-tap': 'Zap',
    'colour-rush': 'Sparkles',
    blackjack: 'WalletCards',
    'wire-cutter': 'Split',
    'lock-picker': 'Crosshair',
    'bomb-defuse': 'BadgeAlert',
    'memory-chain': 'Brain',
    'number-guess': 'Hash',
    'trivia-blitz': 'CircleHelp',
    'exact-timer': 'Clock3',
    'sequence-tap': 'Rows3',
    'hold-button': 'MousePointerClick',
    'sorting-sprint': 'ArrowDownAZ',
    'bluff-breaker': 'Drama',
    'token-toss': 'CircleDollarSign',
    'name-three': 'Timer',
  };
  return map[id];
}

function PauseMenu({
  game,
  settings,
  setGame,
  setScreen,
  onClose,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
  setScreen: (screen: ScreenName) => void;
  onClose: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <Modal title="Pause Menu" className="pause-modal">
      <div className="button-grid">
        <button className="secondary-button" type="button" onClick={onClose}>
          <Icons.Play aria-hidden="true" />
          Return to Board
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowHistory((value) => !value)}
        >
          <Icons.History aria-hidden="true" />
          Game History
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setGame((state) => (state ? restartTurn(state) : state))}
        >
          <Icons.Rewind aria-hidden="true" />
          Restart Turn
        </button>
        <button className="secondary-button" type="button" onClick={() => setScreen('home')}>
          <Icons.Home aria-hidden="true" />
          Return Home
        </button>
      </div>
      <Scoreboard game={game} settings={settings} />
      {showHistory && (
        <ol className="history-list">
          {game.history
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.id}>{event.message}</li>
            ))}
        </ol>
      )}
    </Modal>
  );
}

function ResultsScreen({
  game,
  settings,
  onPlayAgain,
  onNewGame,
  onHome,
}: {
  game: GameState;
  settings: GameSettings;
  onPlayAgain: () => void;
  onNewGame: () => void;
  onHome: () => void;
}) {
  const ordered = [...game.players].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999));
  const winner = ordered[0];
  const [copyMessage, setCopyMessage] = useState('');
  const totalDrinks = game.players.reduce((sum, player) => sum + player.drinks, 0);
  const totalShots = game.players.reduce((sum, player) => sum + player.shots, 0);
  const awards = buildAwards(game.players);

  return (
    <main className="results-screen">
      <img className="results-logo" src="./assets/branding/blackout-logo.png" alt="Black Out!" />
      <p className="eyebrow">Winner</p>
      <h1>{winner?.name ?? 'Game Complete'}</h1>
      <section className="podium">
        {ordered.map((player) => (
          <article key={player.id} style={{ '--counter-colour': player.colour } as CSSProperties}>
            <span>{player.placement}</span>
            <strong>{player.name}</strong>
            <small>
              {player.drinks} {drinkWord(player.drinks, settings.alcoholFreeMode)} · {player.shots}{' '}
              {shotWord(player.shots, settings.alcoholFreeMode)}
            </small>
          </article>
        ))}
      </section>
      <section className="result-stats">
        <span>Total turns: {game.turnNumber}</span>
        <span>
          Game-wide {drinkWord(totalDrinks, settings.alcoholFreeMode)}: {totalDrinks}
        </span>
        <span>
          Game-wide {shotWord(totalShots, settings.alcoholFreeMode)}: {totalShots}
        </span>
      </section>
      <section className="awards">
        {awards.map((award) => (
          <article key={award.label}>
            <strong>{award.label}</strong>
            <span>{award.player}</span>
          </article>
        ))}
      </section>
      <details className="export-preview">
        <summary>View Game History</summary>
        <pre>{buildResultsText(game, settings)}</pre>
      </details>
      <div className="button-grid">
        <button className="primary-button" type="button" onClick={onPlayAgain}>
          <Icons.RefreshCw aria-hidden="true" />
          Play Again With Same Players
        </button>
        <button className="secondary-button" type="button" onClick={onNewGame}>
          <Icons.Plus aria-hidden="true" />
          New Game
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            copyResultsToClipboard(game, settings)
              .then((copied) =>
                setCopyMessage(copied ? 'Copied results.' : 'Clipboard unavailable.'),
              )
              .catch(() => setCopyMessage('Clipboard unavailable.'));
          }}
        >
          <Icons.Copy aria-hidden="true" />
          Copy Results
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => downloadResultsPng(game, settings)}
        >
          <Icons.Download aria-hidden="true" />
          Download PNG
        </button>
        <button className="secondary-button" type="button" onClick={onHome}>
          <Icons.Home aria-hidden="true" />
          Return Home
        </button>
      </div>
      {copyMessage && <p role="status">{copyMessage}</p>}
    </main>
  );
}

function buildAwards(players: Player[]): { label: string; player: string }[] {
  const by = (score: (player: Player) => number) =>
    [...players].sort((a, b) => score(b) - score(a))[0]?.name ?? 'No one';
  return [
    {
      label: 'First Place',
      player:
        [...players].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))[0]?.name ??
        'No one',
    },
    { label: 'Minigame Champion', player: by((player) => player.statistics.minigamesWon) },
    { label: 'Most Shielded', player: by((player) => player.statistics.shieldsUsed) },
    {
      label: 'Biggest Risk Taker',
      player: by((player) => player.statistics.largestSingleAssignment),
    },
  ];
}

function Modal({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const button = ref.current?.querySelector(
      'button, input, select, summary',
    ) as HTMLElement | null;
    button?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        {children}
      </section>
    </div>
  );
}
