import { join } from "node:path";
import { findRepoRoot } from "../browser/session-paths.js";

/**
 * Каталог кэша чтений (`cache/data/` в корне репозитория). Корень ищем по
 * `pnpm-workspace.yaml`, а не от `process.cwd()`: сервер и `seed:cache`
 * запускаются с разным cwd и должны видеть один и тот же кэш.
 * Переопределяется переменной `MCP_CACHE_DIR`.
 */
export function resolveCacheDir(): string {
  const override = process.env.MCP_CACHE_DIR;
  if (override) return override;
  return join(findRepoRoot(), "cache", "data");
}
