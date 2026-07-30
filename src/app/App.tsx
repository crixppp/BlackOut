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
  Minus,
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
  Save,
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
  applyManualAdjustment,
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
  BOARD_TILE_COUNT,
  DEFAULT_SETTINGS,
  FINISH_POSITION,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLOURS,
  type BoardTile,
  type GameSettings,
  type GameState,
  type MinigameId,
  type Player,
  type PlayerDraft,
  type ScreenName,
  type SpinnerSegmentId,
  type TileChoice,
} from '../types/game';
import { createId } from '../utils/ids';
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
  Minus,
  Play,
  Plus,
  RefreshCw,
  Rewind,
  RotateCcw,
  RotateCw,
  Save,
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
      }, 950);
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
          setSettings={setSettings}
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
        <span>Black Out!</span>
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
        <p>Every action can be confirmed, corrected, skipped, or adjusted by the host.</p>
        <p>
          The first player to reach Finish wins, and the game continues until everyone finishes.
        </p>
        <p>
          Assigned drinks are game scores only. They are not health, safety, or BAC measurements.
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
  setSettings,
  setScreen,
  pauseOpen,
  setPauseOpen,
  wakeLocked,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
  setSettings: (settings: GameSettings) => void;
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

      <TurnModal game={game} settings={settings} setGame={setGame} />
      {game.currentTileResolution && (
        <TileActionModal
          game={game}
          settings={settings}
          setGame={setGame}
          setSettings={setSettings}
        />
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

  useEffect(() => {
    activeTileRef.current?.scrollIntoView({
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
        <div className="board-grid">
          {spaces.map((space) => {
            const playersHere = game.players.filter((player) => player.position === space.position);
            const isActive = current.position === space.position;
            return (
              <BoardSpace
                key={space.position}
                position={space.position}
                tile={space.tile}
                label={space.label}
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
  players,
  isActive,
  refCallback,
}: {
  position: number;
  tile: BoardTile | null;
  label: string;
  players: Player[];
  isActive: boolean;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  const coords = boardCoordinates(position);
  return (
    <div
      ref={refCallback}
      className={`board-tile variant-${tile?.backgroundVariant ?? (position === 0 ? 'start' : 'finish')} ${isActive ? 'active' : ''}`}
      style={{ gridColumn: coords.column, gridRow: coords.row } as CSSProperties}
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

function boardCoordinates(position: number): { column: number; row: number } {
  const columns = 8;
  const rows = Math.ceil((BOARD_TILE_COUNT + 2) / columns);
  const rowFromBottom = Math.floor(position / columns);
  const leftToRight = rowFromBottom % 2 === 0;
  const column = leftToRight ? (position % columns) + 1 : columns - (position % columns);
  return {
    column,
    row: rows - rowFromBottom,
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

function TurnModal({
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

  if (game.turnPhase === 'resolving-tile' || game.turnPhase === 'game-complete') {
    return null;
  }

  return (
    <Modal title={`${current.name}'s turn`} className="turn-modal">
      <div aria-live="polite" className="sr-only">
        {announced}
      </div>
      <div className="turn-player" style={{ '--player-colour': current.colour } as CSSProperties}>
        <span className="large-counter">{current.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{current.name}</h2>
          <p>
            Space {current.position} · {current.drinks}{' '}
            {drinkWord(current.drinks, settings.alcoholFreeMode)} · {current.shots}{' '}
            {shotWord(current.shots, settings.alcoholFreeMode)}
          </p>
        </div>
      </div>
      <DiceView value={game.pendingRoll?.value ?? 1} rolling={game.turnPhase === 'rolling'} />
      {game.turnPhase === 'awaiting-roll' && (
        <button
          className="primary-button huge"
          type="button"
          onClick={() =>
            setGame((state) => (state ? rollDice(state, settings, randomSource) : state))
          }
        >
          <Icons.Dices aria-hidden="true" />
          Roll Dice
        </button>
      )}
      {game.turnPhase === 'rolling' && <p className="motion-label">Rolling...</p>}
      {game.turnPhase === 'moving' && (
        <div className="button-row">
          <p className="motion-label">Moving {game.pendingRoll?.value} spaces</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setGame((state) => (state ? advanceMovementToEnd(state) : state))}
          >
            <Icons.SkipForward aria-hidden="true" />
            Skip Animation
          </button>
        </div>
      )}
      {game.turnPhase === 'confirming-result' && (
        <div className="stack">
          <p>
            Exact roll required. {current.name} stays on space {current.position}.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setGame((state) => (state ? moveToNextTurn(state) : state))}
          >
            <Icons.Check aria-hidden="true" />
            End Turn
          </button>
        </div>
      )}
      {game.turnPhase === 'turn-complete' && (
        <button
          className="primary-button huge"
          type="button"
          onClick={() => setGame((state) => (state ? moveToNextTurn(state) : state))}
        >
          <Icons.ArrowRight aria-hidden="true" />
          Next Player
        </button>
      )}
    </Modal>
  );
}

function DiceView({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`dice ${rolling ? 'rolling' : ''}`}
      role="img"
      aria-label={`Dice face ${value}`}
    >
      {value}
    </div>
  );
}

function TileActionModal({
  game,
  settings,
  setGame,
  setSettings,
}: {
  game: GameState;
  settings: GameSettings;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
  setSettings: (settings: GameSettings) => void;
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
  const [hostOpen, setHostOpen] = useState(false);
  const [minigameNonce, setMinigameNonce] = useState(createId('mini'));
  const actionSubmittedRef = useRef(false);

  if (!tile) {
    return null;
  }

  const display = settings.alcoholFreeMode ? tile.alcoholFreeText : tile;
  const targets = getEligibleTargets(game, true);
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
    const choice: TileChoice = {
      targetPlayerId: targetId,
      secondaryTargetPlayerId: secondaryTargetId,
      shieldUsedByPlayerId: shieldTargetId,
      spinnerResult,
      minigameLoserId,
      minigameWinnerId,
      ...extra,
    };
    setGame((state) => (state ? resolveCurrentTile(state, settings, randomSource, choice) : state));
  };

  const submitResult = (extra: TileChoice = {}) => {
    resolve(extra);
  };

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
          players={targets}
          value={secondaryTargetId ?? targetId}
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
          key={minigameNonce}
          id={String(tile.actionConfig?.minigameId) as MinigameId}
          game={game}
          settings={settings}
          loserId={minigameLoserId}
          winnerId={minigameWinnerId}
          setLoserId={setMinigameLoserId}
          setWinnerId={setMinigameWinnerId}
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

      <details
        className="host-controls"
        open={hostOpen}
        onToggle={(event) => setHostOpen(event.currentTarget.open)}
      >
        <summary>Host controls</summary>
        <div className="host-grid">
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setGame((state) => (state ? applyManualAdjustment(state, targetId, 1, 0) : state))
            }
          >
            <Icons.Plus aria-hidden="true" />
            +1 {drinkWord(1, settings.alcoholFreeMode)}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setGame((state) => (state ? applyManualAdjustment(state, targetId, -1, 0) : state))
            }
          >
            <Icons.Minus aria-hidden="true" />
            -1 {drinkWord(1, settings.alcoholFreeMode)}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              setGame((state) => (state ? applyManualAdjustment(state, targetId, 0, 1) : state))
            }
          >
            <Icons.Plus aria-hidden="true" />
            +1 {shotWord(1, settings.alcoholFreeMode)}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setMinigameNonce(createId('mini'))}
          >
            <Icons.RotateCcw aria-hidden="true" />
            Replay Minigame
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setGame((state) => (state ? restartTurn(state) : state))}
          >
            <Icons.Rewind aria-hidden="true" />
            Restart Turn
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSettings({ ...settings })}
          >
            <Icons.Save aria-hidden="true" />
            Save Settings
          </button>
        </div>
      </details>

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
}: {
  id: MinigameId;
  game: GameState;
  settings: GameSettings;
  loserId?: string;
  winnerId?: string;
  setLoserId: (id: string | undefined) => void;
  setWinnerId: (id: string | undefined) => void;
}) {
  const players = getEligibleTargets(game, true);
  const current = getCurrentPlayer(game);
  const [touches, setTouches] = useState<Map<number, string>>(new Map());
  const [numberTarget] = useState(() => randomSource.integer(1, 20));
  const [guess, setGuess] = useState('');
  const [guessMessage, setGuessMessage] = useState(
    'Three guesses. Host decides the final outcome.',
  );
  const [prompt] = useState(() => randomSource.pick(CATEGORY_PROMPTS));
  const [trivia] = useState(() => randomSource.pick(TRIVIA_QUESTIONS));
  const [sorting] = useState(() => randomSource.pick(SORTING_PUZZLES));

  const selectedLoser = loserId ?? players[0]?.id;
  const selectedWinner = winnerId ?? current.id;

  const pickRandomLoser = () => {
    setLoserId(randomSource.pick(players).id);
  };

  const submitGuess = () => {
    const value = Number(guess);
    if (!Number.isFinite(value)) {
      setGuessMessage('Enter a number first.');
      return;
    }
    if (value === numberTarget) {
      setGuessMessage('Correct. Mark a winner or skip the penalty.');
      setWinnerId(current.id);
      return;
    }
    setGuessMessage(value < numberTarget ? 'Higher.' : 'Lower.');
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
        <p>Choose an opponent. Each rolls once; lower result is marked below.</p>
      )}
      {id === 'reaction-tap' && <ReactionTapMini setLoserId={setLoserId} players={players} />}
      {id === 'memory-chain' && (
        <p>
          Build a chain from the category <strong>{prompt}</strong>. Use the host buttons for
          correct, miss, or skip.
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
      {id === 'exact-timer' && <TimerMini />}
      {id === 'sequence-tap' && <SequenceMini />}
      {id === 'hold-button' && <HoldButtonMini />}
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
          onChange={setLoserId}
        />
      </div>
    </section>
  );
}

function ReactionTapMini({
  players,
  setLoserId,
}: {
  players: Player[];
  setLoserId: (id: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'waiting' | 'tap'>('idle');
  const [message, setMessage] = useState(
    'Start the round, then tap only when the screen turns yellow.',
  );

  const start = () => {
    setState('waiting');
    setMessage('Wait for yellow...');
    window.setTimeout(
      () => {
        setState('tap');
        setMessage('TAP');
      },
      randomSource.integer(900, 2400),
    );
  };

  return (
    <div className={`reaction-zone ${state}`}>
      <strong>{message}</strong>
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={start}>
          Start
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

function TimerMini() {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState('Target is 7.00 seconds.');
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
          setRunning(false);
          setResult(`${elapsed.toFixed(2)} seconds`);
        }}
      >
        Stop
      </button>
      <span>{result}</span>
    </div>
  );
}

function SequenceMini() {
  const sequence = useMemo(
    () => ['yellow', 'white', 'red', 'cyan'].slice(0, randomSource.integer(3, 4)),
    [],
  );
  return (
    <div className="sequence-row">
      {sequence.map((colour, index) => (
        <span key={`${colour}-${index}`} className={`sequence-dot ${colour}`}>
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function HoldButtonMini() {
  const [holding, setHolding] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [label, setLabel] = useState('Hold, then release near 3 seconds.');
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
        setHolding(false);
        setLabel(`${elapsed.toFixed(2)} seconds`);
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
