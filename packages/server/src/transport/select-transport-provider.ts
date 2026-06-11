import { StdioTransportProvider } from "./stdio-transport-provider.js";
import { HttpTransportProvider } from "./http-transport-provider.js";
import type { ServerTransportProvider } from "./transport-provider.js";

/**
 * Выбор транспорта по флагу или переменной окружения (флаг приоритетнее env):
 *   --transport stdio|http      MCP_TRANSPORT=stdio|http   (по умолчанию stdio)
 *   --host <iface>              MCP_HTTP_HOST
 *   --port <n>                  MCP_HTTP_PORT
 *   --path </mcp>              MCP_HTTP_PATH
 *   --token <secret>           MCP_HTTP_TOKEN   (опц.: Bearer-доступ за туннелем)
 * stdio оставлен дефолтом: фаза 1 (Claude Desktop, дочерний процесс) надёжнее всего.
 */
export function selectTransportProvider(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ServerTransportProvider {
  const choice = (getFlag(argv, "transport") ?? env.MCP_TRANSPORT ?? "stdio").toLowerCase();

  if (choice === "stdio") return new StdioTransportProvider();
  if (choice === "http") {
    return new HttpTransportProvider({
      host: getFlag(argv, "host") ?? env.MCP_HTTP_HOST,
      port: parsePort(getFlag(argv, "port") ?? env.MCP_HTTP_PORT),
      path: getFlag(argv, "path") ?? env.MCP_HTTP_PATH,
      token: getFlag(argv, "token") ?? env.MCP_HTTP_TOKEN,
    });
  }
  throw new Error(`unknown transport: ${choice} (expected "stdio" or "http")`);
}

/** Достаёт значение флага в обеих формах: `--name value` и `--name=value`. */
function getFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) return argv[i + 1];
    if (arg.startsWith(`${prefix}=`)) return arg.slice(prefix.length + 1);
  }
  return undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`invalid port: ${value}`);
  }
  return port;
}
