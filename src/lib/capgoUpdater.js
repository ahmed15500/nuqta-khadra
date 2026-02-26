import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const LAST_APPLIED_VERSION_KEY = "nuqta_capgo_last_applied_version";

const normalizeVersion = (value) =>
  String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];

const compareVersions = (a, b) => {
  const aParts = normalizeVersion(a)
    .split(".")
    .map((x) => Number.parseInt(x || "0", 10));
  const bParts = normalizeVersion(b)
    .split(".")
    .map((x) => Number.parseInt(x || "0", 10));

  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const aVal = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bVal = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
};

const maxVersion = (versions) =>
  versions
    .filter(Boolean)
    .map((v) => normalizeVersion(v))
    .reduce((max, current) => (compareVersions(current, max) > 0 ? current : max), "0.0.0");

const resolveDistZipAsset = (release) =>
  (release?.assets || []).find((asset) => {
    const name = String(asset?.name || "").toLowerCase();
    return name === "dist.zip" || name.endsWith("/dist.zip") || name.endsWith("dist.zip");
  });

let started = false;

export function initCapgoLiveUpdates({ enabled, repo, currentVersion }) {
  if (started) return;
  started = true;

  if (!Capacitor.isNativePlatform()) return;

  // Must be called on each app launch to mark bundle as healthy and avoid rollback.
  CapacitorUpdater.notifyAppReady().catch(() => {
    // Keep startup resilient.
  });

  if (!enabled) return;

  const normalizedCurrentVersion = normalizeVersion(currentVersion || "0.0.0");
  if (!repo || !normalizedCurrentVersion || normalizedCurrentVersion === "0.0.0") return;

  let checking = false;

  const runCheck = async () => {
    if (checking) return;
    checking = true;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest?ts=${Date.now()}`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) return;

      const release = await response.json();
      const latestVersion = normalizeVersion(release?.tag_name || release?.name);
      if (!latestVersion) return;

      const distZip = resolveDistZipAsset(release);
      if (!distZip?.browser_download_url) return;

      const runtimeBundle = await CapacitorUpdater.current().catch(() => null);
      const runtimeVersion = normalizeVersion(runtimeBundle?.bundle?.version || "");
      const localApplied = normalizeVersion(localStorage.getItem(LAST_APPLIED_VERSION_KEY) || "");
      const baselineVersion = maxVersion([normalizedCurrentVersion, runtimeVersion, localApplied]);

      if (compareVersions(latestVersion, baselineVersion) <= 0) return;

      const downloaded = await CapacitorUpdater.download({
        version: latestVersion,
        url: distZip.browser_download_url
      });

      localStorage.setItem(LAST_APPLIED_VERSION_KEY, latestVersion);
      await CapacitorUpdater.set(downloaded);
    } catch {
      // Keep app stable if update check/download fails.
    } finally {
      checking = false;
    }
  };

  runCheck();
  const intervalId = window.setInterval(runCheck, CHECK_INTERVAL_MS);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      runCheck();
    }
  };

  window.addEventListener("online", runCheck);
  window.addEventListener("focus", runCheck);
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.addEventListener("beforeunload", () => {
    window.clearInterval(intervalId);
    window.removeEventListener("online", runCheck);
    window.removeEventListener("focus", runCheck);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
}

