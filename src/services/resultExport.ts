import type { GameSettings, GameState, Player } from '../types/game';
import { drinkWord, shotWord } from '../utils/text';

export function buildResultsText(state: GameState, settings: GameSettings): string {
  const ordered = [...state.players].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999));
  const lines = [
    'BLACK OUT! RESULTS',
    '',
    ...ordered.map((player) => `${player.placement ?? '-'} . ${player.name}`.replace(' .', '.')),
    '',
    'Game assignments:',
    ...state.players.map((player) => formatPlayerScore(player, settings)),
  ];
  return lines.join('\n');
}

export async function copyResultsToClipboard(
  state: GameState,
  settings: GameSettings,
): Promise<boolean> {
  const text = buildResultsText(state, settings);
  if (!navigator.clipboard) {
    return false;
  }
  await navigator.clipboard.writeText(text);
  return true;
}

export function downloadResultsPng(state: GameState, settings: GameSettings): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) {
    return false;
  }

  context.fillStyle = '#080808';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffd400';
  context.font = 'bold 72px system-ui, sans-serif';
  context.fillText('BLACK OUT!', 80, 120);
  context.fillStyle = '#ffffff';
  context.font = '32px system-ui, sans-serif';

  const lines = buildResultsText(state, settings).split('\n').slice(2);
  lines.forEach((line, index) => {
    context.fillText(line, 80, 190 + index * 46);
  });

  const link = document.createElement('a');
  link.download = `black-out-results-${state.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  return true;
}

function formatPlayerScore(player: Player, settings: GameSettings): string {
  return `${player.name}: ${player.drinks} ${drinkWord(player.drinks, settings.alcoholFreeMode)}, ${player.shots} ${shotWord(player.shots, settings.alcoholFreeMode)}`;
}
