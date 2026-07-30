export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 20);
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function drinkWord(count: number, alcoholFreeMode: boolean): string {
  if (alcoholFreeMode) {
    return count === 1 ? 'point' : 'points';
  }
  return count === 1 ? 'sip' : 'sips';
}

export function shotWord(count: number, alcoholFreeMode: boolean): string {
  if (alcoholFreeMode) {
    return count === 1 ? 'penalty' : 'penalties';
  }
  return count === 1 ? 'shot' : 'shots';
}

export function alcoholFreeCopy(text: string): string {
  return text
    .replace(/\bshots\b/gi, 'penalties')
    .replace(/\bshot\b/gi, 'penalty')
    .replace(/\bsips\b/gi, 'points')
    .replace(/\bsip\b/gi, 'point')
    .replace(/\bdrinks\b/gi, 'points')
    .replace(/\bdrink\b/gi, 'point');
}

export function compactList(items: string[]): string {
  if (items.length <= 2) {
    return items.join(' and ');
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
