import { describe, expect, it } from 'vitest';
import { BOARD_TILES, MINIGAME_IDS } from '../data/tiles';
import { BOARD_TILE_COUNT } from '../types/game';

describe('tile catalogue', () => {
  it('contains exactly 60 numbered movement spaces', () => {
    expect(BOARD_TILES).toHaveLength(BOARD_TILE_COUNT);
    expect(BOARD_TILES.map((tile) => tile.id)).toEqual(
      Array.from({ length: BOARD_TILE_COUNT }, (_, index) => index + 1),
    );
  });

  it('keeps duplicate tile text under the repeat limit and spaced apart', () => {
    const seen = new Map<string, number[]>();
    for (const tile of BOARD_TILES) {
      const key = `${tile.title}|${tile.description}`;
      seen.set(key, [...(seen.get(key) ?? []), tile.id]);
    }

    for (const ids of seen.values()) {
      expect(ids.length).toBeLessThanOrEqual(2);
      if (ids.length > 1) {
        expect(Math.abs(ids[1] - ids[0])).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('references only implemented minigame ids', () => {
    const ids = new Set(MINIGAME_IDS);
    for (const tile of BOARD_TILES.filter((entry) => entry.actionType === 'minigame')) {
      expect(ids.has(String(tile.actionConfig?.minigameId) as never)).toBe(true);
    }
  });

  it('has alternate wording for every tile', () => {
    for (const tile of BOARD_TILES) {
      expect(tile.alcoholFreeText.title.length).toBeGreaterThan(0);
      expect(tile.alcoholFreeText.description.length).toBeGreaterThan(0);
    }
  });

  it('does not include removed board concepts in playable tile copy', () => {
    const removed = [
      ['Goose', ' who ', 'drinks'].join(''),
      ['Rock', ' paper ', 'scissors'].join(''),
      ['Swap', ' spaces'].join(''),
      ['Players', ' drink ', 'dr'].join(''),
      ['Slap', ' someone'].join(''),
      ['Never', ' have ', 'I ever'].join(''),
      ['Dare', ' drink'].join(''),
      ['Talk', ' with ', 'accent'].join(''),
      ['10 second', ' dance'].join(''),
      ['Black', ' hole'].join(''),
      ['Truth', ' drink'].join(''),
      ['Bar', 'tender'].join(''),
      ['Party', ' foul'].join(''),
    ];
    const copy = BOARD_TILES.map((tile) => `${tile.title} ${tile.description}`)
      .join('\n')
      .toLocaleLowerCase();

    for (const phrase of removed) {
      expect(copy).not.toContain(phrase.toLocaleLowerCase());
    }
  });
});
