/** Splits `items` into lists of at most `size` items: chunk([1, 2, 3], 2) -> [[1, 2], [3]]. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}
