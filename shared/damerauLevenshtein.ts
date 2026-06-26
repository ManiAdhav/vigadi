/** Damerau-Levenshtein distance — handles transpositions (e.g. sorakai → sorakkai). */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const maxDist = al + bl;
  const da: Record<string, number> = {};
  const d: number[][] = Array.from({ length: al + 2 }, () =>
    Array(bl + 2).fill(0)
  );

  d[0][0] = maxDist;
  for (let i = 0; i <= al; i++) {
    d[i + 1][0] = maxDist;
    d[i + 1][1] = i;
  }
  for (let j = 0; j <= bl; j++) {
    d[0][j + 1] = maxDist;
    d[1][j + 1] = j;
  }

  for (let i = 1; i <= al; i++) {
    let db = 0;
    for (let j = 1; j <= bl; j++) {
      const i1 = da[b[j - 1]] ?? 0;
      const j1 = db;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }
      d[i + 1][j + 1] = Math.min(
        d[i][j + 1] + 1,
        d[i + 1][j] + 1,
        d[i][j] + cost,
        d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    da[a[i - 1]] = i;
  }

  return d[al + 1][bl + 1];
}

export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;
  if (target.startsWith(query)) return 1;
  if (target.includes(query)) return 0.85;

  const maxLen = Math.max(query.length, target.length);
  const dist = damerauLevenshtein(query, target);
  const similarity = 1 - dist / maxLen;

  // Allow 1 typo per 4 chars (e.g. sorakai vs sorakkai)
  const threshold = query.length <= 4 ? 1 : Math.ceil(query.length / 4);
  return dist <= threshold ? similarity : 0;
}
