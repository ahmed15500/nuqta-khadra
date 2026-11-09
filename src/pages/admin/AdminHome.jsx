import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { Users, Recycle, Coins, Store, Sparkles, History, Trophy } from "lucide-react";
import { supabase } from "../../lib/supabase";

const STORE_ROLES = ["collector_store", "partner_store"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#64748b"];

async function loadProfilesWithOptionalPhoto() {
  const selectWithPhoto = "id,name,phone,role,points,store_name,store_category,photo_url,disabled,created_at";
  const selectWithoutPhoto = "id,name,phone,role,points,store_name,store_category,disabled,created_at";

  const withPhoto = await supabase.from("profiles").select(selectWithPhoto).order("created_at", { ascending: false });
  if (!withPhoto.error) return withPhoto;

  const maybeMissingColumn = String(withPhoto.error?.message || "").toLowerCase().includes("photo_url");
  if (!maybeMissingColumn) return withPhoto;

  const fallback = await supabase.from("profiles").select(selectWithoutPhoto).order("created_at", { ascending: false });
  if (!fallback.error) {
    fallback.data = (fallback.data || []).map((item) => ({ ...item, photo_url: "" }));
  }
  return fallback;
}

// Run a query and never throw: failures degrade to an empty list + a warning label.
async function safeLoad(label, promise) {
  try {
    const { data, error } = await promise;
    if (error) return { label, data: [], failed: true };
    return { label, data: data || [], failed: false };
  } catch {
    return { label, data: [], failed: true };
  }
}

function asNumber(value) {
  return Number(value || 0);
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("ar-EG")} - ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
}

const dashStyles = `
.dash-stat { display:flex; flex-direction:column; gap:10px; border-radius:24px; }
.dash-stat-top { display:flex; align-items:center; justify-content:space-between; }
.dash-stat-icon { width:46px; height:46px; border-radius:16px; display:flex; align-items:center; justify-content:center; color:#fff; }
.dash-stat-label { color:var(--muted); font-size:13px; font-weight:700; }
.dash-stat-value { font-size:30px; font-weight:800; line-height:1.1; }
.dash-chart-card { border-radius:28px; }
.dash-feed { display:flex; flex-direction:column; gap:14px; }
.dash-feed-item { display:flex; gap:12px; align-items:flex-start; }
.dash-feed-icon { width:42px; height:42px; border-radius:14px; background:var(--mint-100); color:var(--green-900); display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
.dash-feed-main { flex:1; min-width:0; }
.dash-feed-row { display:flex; justify-content:space-between; gap:8px; align-items:baseline; }
.dash-feed-points { color:var(--success); font-weight:800; white-space:nowrap; }
.dash-legend { display:flex; flex-direction:column; gap:10px; }
.dash-legend-row { display:flex; align-items:center; gap:10px; border-bottom:1px dashed rgba(19,92,79,.12); padding-bottom:8px; }
.dash-legend-dot { width:12px; height:12px; border-radius:999px; flex-shrink:0; }
.dash-warn { background:#fdf3e3; border:1px solid #e8cf9f; color:#7a5410; border-radius:16px; padding:10px 14px; font-size:14px; }
.dash-leader { display:flex; flex-direction:column; gap:10px; }
.dash-leader-row { display:flex; align-items:center; gap:12px; background:var(--sand-50); border:1px solid rgba(19,92,79,.08); border-radius:16px; padding:10px 14px; }
.dash-leader-rank { width:30px; height:30px; border-radius:999px; background:var(--green-900); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0; }
`;

export default function AdminHome() {
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [wasteTypes, setWasteTypes] = useState([]);
  const [wasteRows, setWasteRows] = useState([]);
  const [transferRows, setTransferRows] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);

  const load = async () => {
    setLoading(true);
    setWarnings([]);

    const [profilesRes, typesRes, wasteRes, transferRes, settlementRes] = await Promise.all([
      safeLoad("الملفات الشخصية", loadProfilesWithOptionalPhoto()),
      safeLoad("أنواع المخلفات", supabase.from("waste_types").select("id,name,icon,points_per_kg").order("name")),
      safeLoad(
        "معاملات المخلفات",
        supabase
          .from("waste_transactions")
          .select("id,user_id,collector_store_id,waste_type_id,weight_kg,points_awarded,created_at")
          .order("created_at", { ascending: false })
      ),
      safeLoad(
        "تحويلات النقاط",
        supabase.from("point_transfers").select("id,transfer_type,points,created_at").order("created_at", { ascending: false })
      ),
      safeLoad(
        "التسويات المالية",
        supabase.from("point_settlements").select("id,cash_amount,points_settled,created_at").order("created_at", { ascending: false })
      )
    ]);

    setLoading(false);

    const results = [profilesRes, typesRes, wasteRes, transferRes, settlementRes];
    setWarnings(results.filter((r) => r.failed).map((r) => r.label));
    setProfiles(profilesRes.data);
    setWasteTypes(typesRes.data);
    setWasteRows(wasteRes.data);
    setTransferRows(transferRes.data);
    setSettlementRows(settlementRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const customers = useMemo(() => profiles.filter((p) => p.role === "user"), [profiles]);
  const shops = useMemo(() => profiles.filter((p) => STORE_ROLES.includes(p.role)), [profiles]);
  const activeShops = useMemo(() => shops.filter((s) => !s.disabled), [shops]);
  const disabledShops = useMemo(() => shops.filter((s) => s.disabled), [shops]);

  const profileById = useMemo(() => {
    const map = new Map();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const typeById = useMemo(() => {
    const map = new Map();
    wasteTypes.forEach((t) => map.set(t.id, t));
    return map;
  }, [wasteTypes]);

  const stats = useMemo(() => {
    const totalWasteKg = wasteRows.reduce((sum, row) => sum + asNumber(row.weight_kg), 0);
    const totalPointsIssued = wasteRows.reduce((sum, row) => sum + asNumber(row.points_awarded), 0);
    const totalCustomerPoints = customers.reduce((sum, row) => sum + asNumber(row.points), 0);
    const totalRedeemed = transferRows
      .filter((row) => row.transfer_type === "user_to_store")
      .reduce((sum, row) => sum + asNumber(row.points), 0);
    const settledCash = settlementRows.reduce((sum, row) => sum + asNumber(row.cash_amount), 0);
    const settledPoints = settlementRows.reduce((sum, row) => sum + asNumber(row.points_settled), 0);

    return {
      customers: customers.length,
      shops: shops.length,
      activeShops: activeShops.length,
      disabledShops: disabledShops.length,
      totalWasteKg,
      totalPointsIssued,
      totalRedeemed,
      totalCustomerPoints,
      settledCash,
      settledPoints,
      settlementsCount: settlementRows.length
    };
  }, [customers, shops, activeShops, disabledShops, wasteRows, transferRows, settlementRows]);

  const pieData = useMemo(() => {
    const totals = new Map();
    wasteRows.forEach((row) => {
      const key = row.waste_type_id || "unknown";
      totals.set(key, (totals.get(key) || 0) + asNumber(row.weight_kg));
    });
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([typeId, kg], idx) => {
        const type = typeById.get(typeId);
        return {
          name: type?.name || "غير معروف",
          icon: type?.icon || "♻️",
          value: Number(kg.toFixed(1)),
          pct: total > 0 ? Math.round((kg / total) * 100) : 0,
          color: PIE_COLORS[idx % PIE_COLORS.length]
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [wasteRows, typeById]);

  const barData = useMemo(() => {
    const buckets = [];
    const byDay = new Map();
    const today = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = dayKey(d);
      const bucket = { key, label: `${d.getDate()}/${d.getMonth() + 1}`, kg: 0, points: 0, ops: 0 };
      buckets.push(bucket);
      byDay.set(key, bucket);
    }
    wasteRows.forEach((row) => {
      const bucket = byDay.get(dayKey(row.created_at));
      if (!bucket) return;
      bucket.kg += asNumber(row.weight_kg);
      bucket.points += asNumber(row.points_awarded);
      bucket.ops += 1;
    });
    return buckets.map((b) => ({ ...b, kg: Number(b.kg.toFixed(1)) }));
  }, [wasteRows]);

  const recentTx = useMemo(
    () =>
      wasteRows.slice(0, 10).map((row) => {
        const user = profileById.get(row.user_id);
        const store = profileById.get(row.collector_store_id);
        const type = typeById.get(row.waste_type_id);
        return {
          id: row.id,
          userName: user?.name || "مستخدم",
          storeName: store?.store_name || store?.name || "",
          typeName: type?.name || "مخلفات",
          typeIcon: type?.icon || "♻️",
          weightKg: asNumber(row.weight_kg),
          points: asNumber(row.points_awarded),
          createdAt: row.created_at
        };
      }),
    [wasteRows, profileById, typeById]
  );

  const storeActivity = useMemo(() => {
    const map = new Map();
    wasteRows.forEach((row) => {
      if (!row.collector_store_id) return;
      const entry = map.get(row.collector_store_id) || { ops: 0, kg: 0 };
      entry.ops += 1;
      entry.kg += asNumber(row.weight_kg);
      map.set(row.collector_store_id, entry);
    });
    return map;
  }, [wasteRows]);

  const insights = useMemo(() => {
    const redeemedRate =
      stats.totalPointsIssued > 0 ? `${Math.round((stats.totalRedeemed / stats.totalPointsIssued) * 100)}%` : "0%";

    const avgCustomerPoints = stats.customers > 0 ? Math.round(stats.totalCustomerPoints / stats.customers) : 0;

    const todayKey = dayKey(new Date());
    const todayWasteOps = wasteRows.filter((row) => dayKey(row.created_at) === todayKey).length;
    const todayTransferOps = transferRows.filter((row) => dayKey(row.created_at) === todayKey).length;

    return [
      {
        title: "نسبة استبدال النقاط",
        value: redeemedRate,
        note: "كلما ارتفعت النسبة زادت حركة الاستفادة من النظام."
      },
      {
        title: "متوسط رصيد العميل",
        value: `${avgCustomerPoints} نقطة`,
        note: "يعكس مستوى تفاعل العملاء مع نقاط المكافآت."
      },
      {
        title: "نشاط اليوم",
        value: `${todayWasteOps} جمع / ${todayTransferOps} تحويل`,
        note: "متابعة النشاط اليومي تساعدك على اكتشاف أي توقف بسرعة."
      },
      {
        title: "إجمالي التسويات المدفوعة",
        value: `${stats.settledCash.toLocaleString("ar-EG")} ج.م`,
        note: `من ${stats.settlementsCount} عملية تسوية بقيمة ${stats.settledPoints.toLocaleString("ar-EG")} نقطة.`
      }
    ];
  }, [stats, wasteRows, transferRows]);

  const topCustomers = useMemo(
    () =>
      [...customers]
        .sort((a, b) => asNumber(b.points) - asNumber(a.points))
        .slice(0, 5),
    [customers]
  );

  const latestShops = useMemo(() => shops.slice(0, 8), [shops]);

  const statCards = [
    { label: "العملاء", value: stats.customers.toLocaleString("ar-EG"), icon: Users, bg: "#2563eb" },
    { label: "المخلفات المجمعة (كجم)", value: stats.totalWasteKg.toLocaleString("ar-EG", { maximumFractionDigits: 1 }), icon: Recycle, bg: "#059669" },
    { label: "النقاط الممنوحة", value: stats.totalPointsIssued.toLocaleString("ar-EG"), icon: Coins, bg: "#d97706" },
    { label: "المحلات (نشط / إجمالي)", value: `${stats.activeShops} / ${stats.shops}`, icon: Store, bg: "#4f46e5" }
  ];

  return (
    <section className="page">
      <style>{dashStyles}</style>
      <h1>لوحة تحكم الإدارة</h1>
      <p className="muted">بيانات مباشرة عن العملاء والمحلات وحركة النقاط في EcoWasteAI.</p>

      <div className="card admin-links">
        <Link to="/admin/stores" className="btn">
          إدارة المحلات
        </Link>
        <Link to="/admin/prices" className="btn btn-outline">
          إدارة أسعار المخلفات
        </Link>
        <Link to="/admin/transactions" className="btn btn-outline">
          إدارة المعاملات
        </Link>
        <Link to="/admin/settlements" className="btn btn-outline">
          التسويات المالية
        </Link>
        <Link to="/admin/leagues" className="btn btn-outline">
          الدوريات
        </Link>
        <Link to="/admin/ask-data" className="btn btn-outline">
          <Sparkles size={16} /> اسأل بياناتك
        </Link>
      </div>

      {loading ? <p className="muted">جاري التحميل...</p> : null}
      {warnings.length ? (
        <p className="dash-warn">تعذر تحميل بعض الأقسام ({warnings.join("، ")}) — تُعرض الأقسام المتاحة فقط.</p>
      ) : null}

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {statCards.map((card) => (
          <div className="card dash-stat" key={card.label}>
            <div className="dash-stat-top">
              <span className="dash-stat-icon" style={{ background: card.bg }}>
                <card.icon size={22} />
              </span>
            </div>
            <span className="dash-stat-label">{card.label}</span>
            <span className="dash-stat-value">{card.value}</span>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div className="card dash-chart-card">
          <h3>توزيع المخلفات حسب النوع (كجم)</h3>
          {pieData.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <div dir="ltr" style={{ width: 220, height: 220, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={4} stroke="none">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} كجم`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="dash-legend" style={{ flex: 1, minWidth: 180 }}>
                {pieData.map((entry) => (
                  <div className="dash-legend-row" key={entry.name}>
                    <span className="dash-legend-dot" style={{ background: entry.color }} />
                    <span style={{ flex: 1 }}>
                      {entry.icon} {entry.name}
                    </span>
                    <strong>{entry.value} كجم</strong>
                    <span className="muted">{entry.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">لا توجد معاملات مخلفات بعد لعرض التوزيع.</p>
          )}
        </div>

        <div className="card dash-chart-card">
          <h3>
            <History size={18} /> أحدث المعاملات
          </h3>
          {recentTx.length ? (
            <div className="dash-feed">
              {recentTx.map((tx) => (
                <div className="dash-feed-item" key={tx.id}>
                  <span className="dash-feed-icon">{tx.typeIcon}</span>
                  <div className="dash-feed-main">
                    <div className="dash-feed-row">
                      <strong>{tx.userName}</strong>
                      <span className="dash-feed-points">+{tx.points} نقطة</span>
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {tx.typeName} ({tx.weightKg} كجم)
                      {tx.storeName ? ` — ${tx.storeName}` : ""}
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                      {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">لا توجد معاملات حديثة.</p>
          )}
          <Link to="/admin/transactions" className="btn btn-outline" style={{ marginTop: 14, display: "inline-block" }}>
            عرض كل المعاملات
          </Link>
        </div>
      </div>

      <div className="card dash-chart-card">
        <h3>نشاط الجمع — آخر 14 يومًا (كجم)</h3>
        {barData.some((b) => b.ops > 0) ? (
          <div dir="ltr" style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip formatter={(value, name) => (name === "kg" ? [`${value} كجم`, "الوزن"] : [value, name])} />
                <Bar dataKey="kg" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="muted">لا يوجد نشاط جمع خلال آخر 14 يومًا.</p>
        )}
      </div>

      <div className="card">
        <h3>رؤى سريعة</h3>
        <div className="insights-grid">
          {insights.map((insight) => (
            <article className="insight-item" key={insight.title}>
              <p className="muted">{insight.title}</p>
              <p className="big">{insight.value}</p>
              <p className="muted">{insight.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div className="card">
          <h3>
            <Trophy size={18} /> أفضل العملاء
          </h3>
          {topCustomers.length ? (
            <div className="dash-leader">
              {topCustomers.map((customer, idx) => (
                <div className="dash-leader-row" key={customer.id}>
                  <span className="dash-leader-rank">{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{customer.name || "-"}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                      {customer.phone || "-"} — {customer.disabled ? "غير مفعل" : "نشط"}
                    </p>
                  </div>
                  <strong>{asNumber(customer.points).toLocaleString("ar-EG")} نقطة</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">لا يوجد عملاء حتى الآن.</p>
          )}
        </div>

        <div className="card">
          <h3>المحلات</h3>
          <div className="shops-grid">
            {latestShops.map((shop) => {
              const activity = storeActivity.get(shop.id) || { ops: 0, kg: 0 };
              return (
                <article className="shop-item" key={shop.id}>
                  <img
                    src={shop.photo_url || "/icons/icon-192.png"}
                    alt={shop.store_name || shop.name || "محل"}
                    className="shop-photo"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/icons/icon-192.png";
                    }}
                  />
                  <div>
                    <h4>{shop.store_name || shop.name || "-"}</h4>
                    <p className="muted">{shop.phone || "-"}</p>
                    <p className="muted">{shop.role === "partner_store" ? "محل شريك" : "محل تجميع"}</p>
                    <p className="muted">
                      {activity.ops} عملية جمع — {activity.kg.toFixed(1)} كجم
                    </p>
                    <p className="muted">{shop.disabled ? "غير مفعل" : "نشط"}</p>
                  </div>
                </article>
              );
            })}
          </div>
          {!latestShops.length && !loading ? <p className="muted">لا توجد محلات حالياً.</p> : null}
        </div>
      </div>
    </section>
  );
}
