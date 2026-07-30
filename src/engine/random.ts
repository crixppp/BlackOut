export interface RandomSource {
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export class CryptoRandomSource implements RandomSource {
  integer(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error('Invalid random range');
    }

    const span = max - min + 1;
    const maxUint = 0xffffffff;
    const limit = maxUint - (maxUint % span);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const value = new Uint32Array(1);
      do {
        crypto.getRandomValues(value);
      } while (value[0] >= limit);
      return min + (value[0] % span);
    }

    return min + Math.floor(Math.random() * span);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list');
    }
    return items[this.integer(0, items.length - 1)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }
}

export class FixedRandomSource implements RandomSource {
  private cursor = 0;

  constructor(private readonly values: number[]) {}

  integer(min: number, max: number): number {
    const raw = this.values[this.cursor] ?? min;
    this.cursor += 1;
    const span = max - min + 1;
    return min + ((((raw - min) % span) + span) % span);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list');
    }
    return items[this.integer(0, items.length - 1)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }
}
