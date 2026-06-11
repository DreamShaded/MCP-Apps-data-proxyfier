import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Прослойка, отвязывающая MCP-сервер (инструменты + ресурсы) от конкретного
 * транспорта. В фазе 1 — stdio; Streamable HTTP добавится позже новой
 * реализацией этого интерфейса, без правок кода инструментов и ресурсов.
 */
export interface ServerTransportProvider {
  /** Понятное человеку имя транспорта, для логов. */
  readonly name: string;
  /**
   * Адрес, на котором слушает транспорт (если он сетевой), — для лога после
   * `create()`. У stdio адреса нет.
   */
  readonly url?: string;
  /** Создать новый транспорт SDK, готовый к передаче в `McpServer.connect`. */
  create(): Promise<Transport> | Transport;
  /**
   * Освободить ресурсы транспорта (сетевой сокет и т.п.) при завершении.
   * У stdio закрывать нечего — реализация опциональна.
   */
  close?(): Promise<void>;
}
