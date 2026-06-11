import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Путь до каталога-профиля браузера (`./.session/` в корне репозитория).
 * Профиль секретен (куки/localStorage залогиненной банковской сессии) и
 * исключён из гита. Переопределяется переменной `MCP_SESSION_DIR`.
 *
 * Корень ищем по `pnpm-workspace.yaml`, а не от `process.cwd()`: скрипт
 * бутстрапа и сервер запускаются с разным cwd (pnpm --filter), и привязка к
 * cwd давала бы два разных профиля.
 */
export function resolveSessionDir(): string {
  const override = process.env.MCP_SESSION_DIR;
  if (override) return override;
  return join(findRepoRoot(), ".session");
}

/** Подняться вверх по дереву каталогов до корня воркспейса (`pnpm-workspace.yaml`). */
export function findRepoRoot(start = dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Корень репозитория (pnpm-workspace.yaml) не найден");
    }
    dir = parent;
  }
}
