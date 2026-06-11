import { useEffect, useState } from "react";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

/**
 * Минимальное MCP-приложение для сквозного каркаса.
 *
 * Отрисовывается сразу (чтобы iframe был виден ещё до прихода результата
 * инструмента — это и снимает риск ошибки с отрисовкой iframe у хоста), затем
 * показывает `structuredContent`, который инструмент `ping` присылает обратно
 * через мост.
 */
interface PingPayload {
  message?: string;
  timestamp?: string;
  echo?: string;
}

export function App() {
  const [payload, setPayload] = useState<PingPayload | null>(null);

  const { isConnected, error } = useApp({
    appInfo: { name: "mcp-app-proxyfier-ping", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => {
        setPayload((params.structuredContent as PingPayload) ?? null);
      };
    },
  });

  return (
    <main className="card">
      <h1>MCP App Proxyfier</h1>
      <p className="subtitle">Tracer-bullet UI rendered inside the host iframe.</p>

      <Status isConnected={isConnected} error={error} />

      {payload ? (
        <dl className="payload">
          <dt>message</dt>
          <dd>{payload.message ?? "—"}</dd>
          <dt>echo</dt>
          <dd>{payload.echo ?? "—"}</dd>
          <dt>timestamp</dt>
          <dd>{payload.timestamp ?? "—"}</dd>
        </dl>
      ) : (
        <p className="hint">Waiting for a <code>ping</code> tool result…</p>
      )}
    </main>
  );
}

function Status({ isConnected, error }: { isConnected: boolean; error: Error | null }) {
  const [dot, setDot] = useState("●");
  useEffect(() => {
    const id = setInterval(() => setDot((d) => (d === "●" ? "○" : "●")), 600);
    return () => clearInterval(id);
  }, []);

  if (error) return <p className="status error">bridge error: {error.message}</p>;
  if (!isConnected) return <p className="status connecting">{dot} connecting to host…</p>;
  return <p className="status connected">connected to host</p>;
}
