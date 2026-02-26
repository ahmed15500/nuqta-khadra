import { useEffect, useMemo, useState } from "react";

const FALLBACK_REPO = "ahmed15500/nuqta-khadra";

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

export default function AppUpdateNotice() {
  const [updateInfo, setUpdateInfo] = useState(null);

  const repo = import.meta.env.VITE_GITHUB_REPO || FALLBACK_REPO;
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
    if (!repo) return;
    if (!currentVersion || currentVersion === "0.0.0") return;

    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" }
        });

        if (!response.ok) return;
        const release = await response.json();
        const latestVersion = normalizeVersion(release.tag_name || release.name);
        if (!latestVersion) return;

        if (compareVersions(latestVersion, currentVersion) <= 0) return;

        const apkAsset = (release.assets || []).find((asset) => /\.apk$/i.test(asset?.name || ""));
        const downloadUrl = apkAsset?.browser_download_url || "";
        if (!downloadUrl) return;

        const savedDismiss = localStorage.getItem(`nuqta_update_dismissed_${latestVersion}`);
        if (savedDismiss === "1") return;

        if (!cancelled) {
          setUpdateInfo({
            latestVersion,
            downloadUrl
          });
        }
      } catch {
        // Ignore update-check errors to keep app startup resilient.
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [repo, currentVersion, isNativeApp]);

  const onUpdate = () => {
    if (!updateInfo?.downloadUrl) return;
    window.open(updateInfo.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const onDismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, "1");
    }
    setUpdateInfo(null);
  };

  if (!isNativeApp || !updateInfo) return null;

  return (
    <section className="update-banner" role="status" aria-live="polite">
      <div className="update-copy">
        <strong>يوجد إصدار جديد متاح للتطبيق</strong>
        <p className="muted">الإصدار الحالي: {currentVersion} - الإصدار الجديد: {updateInfo.latestVersion}</p>
      </div>
      <div className="update-actions">
        <button className="btn btn-small" onClick={onUpdate}>
          تحديث الآن
        </button>
        <button className="btn btn-outline btn-small" onClick={onDismiss}>
          لاحقًا
        </button>
      </div>
    </section>
  );
}
