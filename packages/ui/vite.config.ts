import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const resolveEntry = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// Каждое MCP-приложение собирается отдельным проходом в свой самодостаточный HTML
// (viteSingleFile инлайнит весь JS/CSS — обязательно для песочницы-iframe, но это
// включает inlineDynamicImports, несовместимый с несколькими входами за один проход).
// Вход выбирается переменной UI_ENTRY; билд гоняется по разу на каждое приложение.
// Первый проход (index) чистит dist/, следующие — дописывают рядом.
const entry = process.env.UI_ENTRY ?? "index";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: entry === "index",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: resolveEntry(`${entry}.html`),
    },
  },
});
