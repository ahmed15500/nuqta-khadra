import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { initCapgoLiveUpdates } from "./lib/capgoUpdater";
import "./index.css";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  // Prevent stale dev cache/service worker from causing local "stuck loading" behavior.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

initCapgoLiveUpdates({
  enabled: import.meta.env.VITE_CAPGO_LIVE_UPDATES === "1",
  repo: import.meta.env.VITE_GITHUB_REPO || "ahmed15500/nuqta-khadra",
  currentVersion: import.meta.env.VITE_APP_VERSION || "0.0.0"
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
