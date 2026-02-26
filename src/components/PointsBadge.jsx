function formatPoints(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function PointsBadge({ points }) {
  return <span className="badge">{formatPoints(points)} نقطة</span>;
}
