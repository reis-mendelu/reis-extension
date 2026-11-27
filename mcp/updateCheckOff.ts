// The plugin build's stand-in for updateCheck.ts (vite.mcp.plugin.config.ts):
// Claude's plugin directory updates the plugin itself, so it never asks GitHub.
export function startUpdateCheck(_current: string, _fetchImpl: typeof fetch): () => string | null {
  return () => null;
}
