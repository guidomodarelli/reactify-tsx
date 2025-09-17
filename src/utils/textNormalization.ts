/**
 * Removes leading and trailing empty lines to avoid creating extra whitespace in generated handlers.
 */
export function trimEmptyEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }

  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }

  return lines.slice(start, end);
}

/**
 * Dedents the provided lines by the minimum leading whitespace shared among them.
 */
export function dedent(lines: string[]): string[] {
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) {
    return lines;
  }

  const minIndent = Math.min(
    ...nonEmpty.map((line) => (line.match(/^\s*/)?.[0].length ?? 0)),
  );

  return lines.map((line) => line.slice(minIndent));
}

/**
 * Normalizes a block body by trimming empty edges, dedenting, and reapplying the base indentation.
 */
export function normalizeBlockBody(body: string, baseIndent: string): string {
  const lines = body.split(/\r?\n/);
  const trimmed = trimEmptyEdges(lines);
  const dedented = dedent(trimmed);

  return dedented
    .map((line) => (line.length === 0 ? '' : `${baseIndent}${line}`))
    .join('\n');
}
