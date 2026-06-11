import { createServer as createHttpServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ServerTransportProvider } from "./transport-provider.js";

/** Настройки HTTP-транспорта (всё опционально, есть разумные дефолты). */
export interface HttpTransportOptions {
  /** Интерфейс прослушивания. По умолчанию localhost — туннель ходит к локали. */
  host?: string;
  /** Порт. По умолчанию 3000. `0` — занять любой свободный (удобно в тестах). */
  port?: number;
  /** Путь MCP-эндпоинта. По умолчанию `/mcp`. */
  path?: string;
  /**
   * Общий секрет для запросов (Bearer). Если задан — запросы без
   * `Authorization: Bearer <token>` отклоняются 401. Туннель — это публичная
   * «ручка» к браузеру с залогиненной банковской сессией, поэтому за туннелем
   * токен обязателен; локально/в тестах не задаётся и проверки нет.
   */
  token?: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const DEFAULT_PATH = "/mcp";

/**
 * Транспорт фазы 2: Streamable HTTP за тем же `ServerTransportProvider`, что и
 * stdio, — код инструментов и ресурсов не трогается. Один экземпляр сервера
 * обслуживает одну сессию: на ноутбуке докладчика за туннелем клиент claude.ai
 * один, а единственный браузер всё равно сериализован мьютексом. Многопользо-
 * вательский режим (сервер-фабрика на сессию) демо фазы 2 не нужен.
 *
 * `host` по умолчанию — localhost: наружу сервер выставляется туннелем
 * (`cloudflared`/`ngrok`), чтобы сохранить живой headed-браузер на этой машине.
 */
export class HttpTransportProvider implements ServerTransportProvider {
  readonly name = "http";

  private readonly host: string;
  private readonly port: number;
  private readonly path: string;
  private readonly token?: string;
  private httpServer?: Server;
  private transport?: StreamableHTTPServerTransport;
  private boundUrl?: string;

  constructor(options: HttpTransportOptions = {}) {
    this.host = options.host ?? DEFAULT_HOST;
    this.port = options.port ?? DEFAULT_PORT;
    this.path = options.path ?? DEFAULT_PATH;
    this.token = options.token || undefined;
  }

  /** Адрес эндпоинта, доступен после `create()` (порт может быть выбран ОС при `0`). */
  get url(): string | undefined {
    return this.boundUrl;
  }

  async create(): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    // Протокольные ошибки SDK (например, повторный initialize на уже поднятой
    // сессии) иначе молча уходят в 4xx — логируем, чтобы их было видно в stderr.
    transport.onerror = (error) => console.error("[mcp-app-proxyfier] transport error:", error);
    this.transport = transport;

    const httpServer = createHttpServer((req, res) => {
      // Маршрутизируем только наш путь; всё прочее — 404, тело SDK читает сам.
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname !== this.path) {
        res.writeHead(404).end();
        return;
      }
      if (!this.authorized(req)) {
        res.writeHead(401).end();
        return;
      }
      transport.handleRequest(req, res).catch((error) => {
        console.error("[mcp-app-proxyfier] http handler error:", error);
        if (!res.headersSent) res.writeHead(500).end();
      });
    });
    this.httpServer = httpServer;

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      httpServer.once("error", onError);
      httpServer.listen(this.port, this.host, () => {
        httpServer.off("error", onError);
        resolve();
      });
    });

    const address = httpServer.address();
    const boundPort = typeof address === "object" && address ? address.port : this.port;
    this.boundUrl = `http://${this.host}:${boundPort}${this.path}`;
    return transport;
  }

  /** Запрос разрешён, если токен не задан или совпадает с `Bearer <token>`. */
  private authorized(req: { headers: Record<string, string | string[] | undefined> }): boolean {
    if (!this.token) return true;
    const header = req.headers["authorization"];
    return header === `Bearer ${this.token}`;
  }

  async close(): Promise<void> {
    await this.transport?.close().catch(() => {});
    const server = this.httpServer;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
