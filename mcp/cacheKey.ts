// The tool cache's key for one call (split from cache.ts): the tool and its arguments in a
// stable order, without response_format.

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])])
    );
  }
  return v;
}

/** The format only changes how a result is printed, not what IS said. */
export function keyOf(tool: string, args: Record<string, unknown>): string {
  const { response_format: _format, ...rest } = args;
  return `${tool} ${JSON.stringify(stable(rest))}`;
}
