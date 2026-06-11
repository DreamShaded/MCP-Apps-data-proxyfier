import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTransportProvider } from "./select-transport-provider.js";
import { StdioTransportProvider } from "./stdio-transport-provider.js";
import { HttpTransportProvider } from "./http-transport-provider.js";

test("defaults to stdio with no flag or env", () => {
  const provider = selectTransportProvider([], {});
  assert.ok(provider instanceof StdioTransportProvider);
});

test("env selects http", () => {
  const provider = selectTransportProvider([], { MCP_TRANSPORT: "http" });
  assert.ok(provider instanceof HttpTransportProvider);
});

test("flag selects http and overrides env", () => {
  const provider = selectTransportProvider(["--transport", "http"], { MCP_TRANSPORT: "stdio" });
  assert.ok(provider instanceof HttpTransportProvider);
});

test("flag accepts the --name=value form", () => {
  const provider = selectTransportProvider(["--transport=http"], {});
  assert.ok(provider instanceof HttpTransportProvider);
});

test("http host/port/path come from flags and bind accordingly", async () => {
  const provider = selectTransportProvider(["--transport", "http", "--port", "0", "--path", "/rpc"]);
  assert.ok(provider instanceof HttpTransportProvider);
  await provider.create();
  assert.match(String(provider.url), /^http:\/\/127\.0\.0\.1:\d+\/rpc$/);
  await provider.close();
});

test("rejects an unknown transport name", () => {
  assert.throws(() => selectTransportProvider([], { MCP_TRANSPORT: "carrier-pigeon" }), /unknown transport/);
});

test("rejects an invalid port", () => {
  assert.throws(
    () => selectTransportProvider(["--transport", "http", "--port", "99999"]),
    /invalid port/,
  );
});
