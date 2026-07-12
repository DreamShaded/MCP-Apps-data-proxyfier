import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Каталог статических данных (`packages/server/data/`). Путь считается от текущего файла
 * (одинаковая глубина что при `tsx src/...`, что при собранном `dist/...`), поэтому не
 * зависит от `process.cwd()`. Переопределяется переменной `MCP_DATA_DIR` (для тестов).
 */
export function resolveDataDir(): string {
  const override = process.env.MCP_DATA_DIR;
  if (override) return override;
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
}
