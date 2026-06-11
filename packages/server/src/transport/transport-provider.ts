import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Прослойка, отвязывающая MCP-сервер (инструменты + ресурсы) от конкретного
 * транспорта. В фазе 1 — stdio; Streamable HTTP добавится позже новой
 * реализацией этого интерфейса, без правок кода инструментов и ресурсов.
 */
export interface ServerTransportProvider {
  /** Понятное человеку имя транспорта, для логов. */
  readonly name: string;
  /** Создать новый транспорт SDK, готовый к передаче в `McpServer.connect`. */
  create(): Promise<Transport> | Transport;
}
