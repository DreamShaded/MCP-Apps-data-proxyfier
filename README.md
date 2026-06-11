# MCP App Proxyfier

A proxying MCP server that serves **interactive MCP Apps** (the official MCP UI
extension) into Claude Desktop. This repository currently contains the **scaffold
tracer bullet**: a stdio MCP server exposing one `ping` tool whose result renders
a minimal React app inside the host's sandbox iframe.

The goal of this slice is to de-risk the host iframe-render path on a real Claude
Desktop build before building the Sber/Megamarket flows.

## Layout

```
packages/
  ui/      React + Vite app, built into a single self-contained dist/index.html
  server/  MCP server (stdio), serves the UI as a ui:// resource + ping tool
```

## Prerequisites

- Node.js 22+ (24 recommended)
- pnpm 11+

## Build

```bash
pnpm install
pnpm build          # builds the UI single-file bundle, then the server
```

`pnpm build` runs the UI build first (it produces `packages/ui/dist/index.html`
with all JS/CSS inlined — no external sources, required for the sandbox iframe),
then compiles the server, which reads that HTML at startup and registers it as a
`ui://` resource.

## Test

```bash
pnpm test           # server tool-layer + transport-seam tests
```

## Run / register in Claude Desktop

The server speaks MCP over **stdio**: Claude Desktop launches it as a child
process. After `pnpm build`, add it to your Claude Desktop config.

Config file location:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add (replace the path with the absolute path to this repo):

```json
{
  "mcpServers": {
    "mcp-app-proxyfier": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-app-proxyfier/packages/server/dist/index.js"]
    }
  }
}
```

Then fully quit and reopen Claude Desktop.

## HITL verification (the point of this slice)

In a Claude Desktop chat, ask the model to call the `ping` tool (e.g. *"call the
ping tool with echo hello"*). Confirm **visually**:

1. An **interactive iframe** is drawn in the chat (a card titled "MCP App
   Proxyfier"), not just the text result.
2. The card shows `message: pong`, `echo: hello`, and a timestamp — i.e. the
   tool's `structuredContent` reached the UI over the bridge.

If only text appears and no iframe renders, you have reproduced the host
iframe-render bug (ext-apps #671) — capture the Claude Desktop version and keep
the text fallback narrative for the demo.

## Session bootstrap (one-time manual login)

The server drives real Sber/Megamarket sites through a **headed Playwright
browser** running on a persistent profile in `./.session/`. You log in **once,
by hand**, and the server reuses that session — no SMS/captcha on camera.

Install the browser binary once:

```bash
pnpm exec playwright install chromium
# or, to use your installed Chrome (gentler on anti-bot):
#   set MCP_BROWSER_CHANNEL=chrome and skip the download
```

Then run the bootstrap:

```bash
pnpm bootstrap:login
```

This opens a visible browser on the `./.session/` profile with Megamarket and
Sber in tabs. Log in manually (phone + SMS, captcha), then **close the browser
window** — cookies/localStorage stay in the profile. Restarting reuses the
session.

> **Profile lock — do not run the server and `bootstrap:login` at the same
> time.** Chromium holds a singleton lock on the profile directory, so a second
> launch on the same profile fails fast with a clear error. Close the bootstrap
> browser before starting the server (and vice-versa).

The profile is a **secret** (it holds an authenticated banking session). It is
git-ignored (`.session/*` except `.gitkeep`) and must never be committed.

Override the profile location with `MCP_SESSION_DIR` if needed.

## `check_session` tool

Before a demo, call the `check_session` tool to confirm the profile is still
logged in. It probes Sber and Megamarket under the current profile and returns
a structured status per site (`loggedIn: true | false | null`) plus an overall
`ok`. It never hangs the demo: a locked profile, missing browser, or timeout
degrades to `ok: false` with a reason instead of throwing.

The login-detection selectors live in
`packages/server/src/browser/session-detectors.ts` and are tuned against the
live sites during bootstrap.

## Transport abstraction

The server is transport-agnostic. Tools and resources are registered on the
`McpServer` with no knowledge of the wire. The transport is chosen behind
`ServerTransportProvider` (`packages/server/src/transport/`). Adding Streamable
HTTP later (phase 2, remote connector) means writing one new provider — no tool
or resource code changes.
