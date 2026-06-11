import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MegamarketApp } from "./megamarket-app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <MegamarketApp />
  </StrictMode>,
);
