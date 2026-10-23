import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { router } from "./router";
import { useApp } from "./store";
import "./index.css";

// Light/dark follows the setting, and macOS when the setting is "system".
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const applyTheme = (animate = true) => {
  const theme = useApp.getState().settings.theme;
  const dark = theme === "dark" || (theme === "system" && darkQuery.matches);
  const root = document.documentElement;
  if (root.classList.contains("dark") === dark) return;
  const toggle = () => root.classList.toggle("dark", dark);
  // Cross-fade the whole window instead of snapping every colour at once.
  if (animate && !reduceMotion.matches && document.startViewTransition) document.startViewTransition(toggle);
  else toggle();
};
applyTheme(false);
darkQuery.addEventListener("change", () => applyTheme());
useApp.subscribe((state, prev) => {
  if (state.settings.theme !== prev.settings.theme) applyTheme();
});

async function boot() {
  // In a plain browser during development, stand in for the Rust backend.
  if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
    const { installMocks } = await import("./dev/mock-tauri");
    installMocks();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}
void boot();
