function formatPoints(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function PointsBadge({ points, className = "" }) {
  const cssClass = `badge ${className}`.trim();
  return (
    <span className={cssClass}>
      <span aria-hidden="true">★</span>
      <span>{formatPoints(points)} نقطة</span>
    </span>
  );
}
