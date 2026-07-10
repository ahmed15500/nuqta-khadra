import { useEffect, useMemo, useState } from "react";

const FALLBACK_REPO = "ahmed15500/nuqta-khadra";
const DEFAULT_UPDATE_API = "https://nxbakauhojxgavjnpsia.supabase.co/functions/v1/nuqta-update";
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

function normalizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
}

function compareVersions(a, b) {
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
}

async function fetchPublicUpdate(updateApi) {
  if (!updateApi) return null;
  const separator = updateApi.includes("?") ? "&" : "?";
  const response = await fetch(`${updateApi}${separator}ts=${Date.now()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const update = payload?.update;
  if (!update?.version || !update?.apk_url) return null;

  return {
    latestVersion: normalizeVersion(update.version),
    downloadUrl: update.apk_url,
    notes: update.notes || "تحديث جديد لتطبيق نقطة خضراء",
    mandatory: Boolean(update.mandatory),
    source: "public"
  };
}

async function fetchGitHubUpdate(repo) {
  if (!repo) return null;
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest?ts=${Date.now()}`, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store"
  });
  if (!response.ok) return null;

  const release = await response.json();
  const latestVersion = normalizeVersion(release.tag_name || release.name);
  const apkAsset = (release.assets || []).find(
    (asset) =>
      /\.apk$/i.test(asset?.name || "") ||
      String(asset?.content_type || "").toLowerCase().includes("android.package-archive")
  );
  const downloadUrl = apkAsset?.browser_download_url || release.html_url || "";
  if (!latestVersion || !downloadUrl) return null;

  return {
    latestVersion,
    downloadUrl,
    notes: release.body || "تحديث جديد لتطبيق نقطة خضراء",
    mandatory: false,
    source: apkAsset ? "apk" : "release"
  };
}

export default function AppUpdateNotice() {
  const [updateInfo, setUpdateInfo] = useState(null);

  const repo = import.meta.env.VITE_GITHUB_REPO || FALLBACK_REPO;
  const updateApi = import.meta.env.VITE_UPDATE_API_URL || DEFAULT_UPDATE_API;
  const currentVersion = normalizeVersion(import.meta.env.VITE_APP_VERSION || "0.0.0");
  const isNativeApp =
    typeof window !== "undefined" &&
    window.Capacitor &&
    (typeof window.Capacitor.isNativePlatform === "function"
      ? window.Capacitor.isNativePlatform()
      : window.Capacitor.getPlatform?.() !== "web");

  const dismissKey = useMemo(
    () => (updateInfo?.latestVersion ? `nuqta_update_dismissed_${updateInfo.latestVersion}` : ""),
    [updateInfo?.latestVersion]
  );

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!isNativeApp) return;
    if (!currentVersion || currentVersion === "0.0.0") return;

    let cancelled = false;

    const run = async () => {
      try {
        const update = (await fetchPublicUpdate(updateApi)) || (await fetchGitHubUpdate(repo));
        if (!update?.latestVersion) return;
        if (compareVersions(update.latestVersion, currentVersion) <= 0) return;

        if (!update.mandatory) {
          const savedDismiss = localStorage.getItem(`nuqta_update_dismissed_${update.latestVersion}`);
          if (savedDismiss === "1") return;
        }

        if (!cancelled) setUpdateInfo(update);
      } catch {
        // Keep startup resilient if update check fails.
      }
    };

    run();
    const intervalId = window.setInterval(run, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [repo, updateApi, currentVersion, isNativeApp]);

  const onUpdate = () => {
    if (!updateInfo?.downloadUrl) return;
    window.location.href = updateInfo.downloadUrl;
  };

  const onDismiss = () => {
    if (updateInfo?.mandatory) return;
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setUpdateInfo(null);
  };

  if (!isNativeApp || !updateInfo) return null;

  return (
    <section className="update-banner" role="alert" aria-live="assertive">
      <div className="update-copy">
        <strong>{updateInfo.mandatory ? "تحديث التطبيق مطلوب" : "يوجد تحديث جديد للتطبيق"}</strong>
        <p className="muted">
          الإصدار الحالي: {currentVersion} - الإصدار الجديد: {updateInfo.latestVersion}
        </p>
        {updateInfo.notes ? <p className="muted">{updateInfo.notes}</p> : null}
      </div>
      <div className="update-actions">
        <button className="btn btn-small" onClick={onUpdate}>
          تنزيل التحديث الآن
        </button>
        {!updateInfo.mandatory ? (
          <button className="btn btn-outline btn-small" onClick={onDismiss}>
            لاحقًا
          </button>
        ) : null}
      </div>
    </section>
  );
}
