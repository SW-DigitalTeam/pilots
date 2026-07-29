import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

// Offline after first load: the service worker caches the app shell, the pose
// model and the audio cue bank, so a dropped connection mid-session never
// interrupts audio or gameplay.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline caching is a progressive enhancement; ignore failures */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
