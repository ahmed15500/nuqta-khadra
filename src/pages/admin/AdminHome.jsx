import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const STORE_ROLES = ["collector_store", "partner_store"];

async function loadProfilesWithOptionalPhoto() {
  const selectWithPhoto = "id,name,phone,role,points,store_name,photo_url,disabled,created_at";
  const selectWithoutPhoto = "id,name,phone,role,points,store_name,disabled,created_at";

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

function asNumber(value) {
  return Number(value || 0);
}

export default function AdminHome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [wasteRows, setWasteRows] = useState([]);
  const [transferRows, setTransferRows] = useState([]);

  const load = async () => {
    setLoading(true);
    setError("");

    const [profilesRes, wasteRes, transferRes] = await Promise.all([
      loadProfilesWithOptionalPhoto(),
      supabase.from("waste_transactions").select("id,weight_kg,points_awarded,created_at").order("created_at", { ascending: false }),
      supabase.from("point_transfers").select("id,transfer_type,points,created_at").order("created_at", { ascending: false })
    ]);

    setLoading(false);

    const firstError = profilesRes.error || wasteRes.error || transferRes.error;
    if (firstError) {
      setError(firstError.message || "تعذر تحميل بيانات لوحة الإدارة.");
      return;
    }

    setProfiles(profilesRes.data || []);
    setWasteRows(wasteRes.data || []);
    setTransferRows(transferRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const customers = useMemo(() => profiles.filter((p) => p.role === "user"), [profiles]);
  const shops = useMemo(() => profiles.filter((p) => STORE_ROLES.includes(p.role)), [profiles]);
  const activeShops = useMemo(() => shops.filter((s) => !s.disabled), [shops]);
  const disabledShops = useMemo(() => shops.filter((s) => s.disabled), [shops]);

  const stats = useMemo(() => {
    const totalWasteKg = wasteRows.reduce((sum, row) => sum + asNumber(row.weight_kg), 0);
    const totalPointsIssued = wasteRows.reduce((sum, row) => sum + asNumber(row.points_awarded), 0);
    const totalCustomerPoints = customers.reduce((sum, row) => sum + asNumber(row.points), 0);
    const totalRedeemed = transferRows
      .filter((row) => row.transfer_type === "user_to_store")
      .reduce((sum, row) => sum + asNumber(row.points), 0);

    return {
      customers: customers.length,
      shops: shops.length,
      activeShops: activeShops.length,
      disabledShops: disabledShops.length,
      totalWasteKg,
      totalPointsIssued,
      totalRedeemed,
      totalCustomerPoints
    };
  }, [customers, shops, activeShops, disabledShops, wasteRows, transferRows]);

  const insights = useMemo(() => {
    const redeemedRate =
      stats.totalPointsIssued > 0 ? `${Math.round((stats.totalRedeemed / stats.totalPointsIssued) * 100)}%` : "0%";

    const avgCustomerPoints =
      stats.customers > 0 ? Math.round(stats.totalCustomerPoints / stats.customers) : 0;

    const today = new Date().toDateString();
    const todayWasteOps = wasteRows.filter((row) => new Date(row.created_at).toDateString() === today).length;
    const todayTransferOps = transferRows.filter((row) => new Date(row.created_at).toDateString() === today).length;

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
        title: "محلات غير مفعلة",
        value: String(stats.disabledShops),
        note: "يمكنك مراجعة هذه المحلات من صفحة إدارة المحلات."
      }
    ];
  }, [stats, wasteRows, transferRows]);

  const topCustomers = useMemo(
    () =>
      [...customers]
        .sort((a, b) => asNumber(b.points) - asNumber(a.points))
        .slice(0, 8),
    [customers]
  );

  const latestShops = useMemo(() => shops.slice(0, 8), [shops]);

  return (
    <section className="page">
      <h1>لوحة تحكم الإدارة</h1>
      <p className="muted">بيانات مباشرة عن العملاء والمحلات وحركة النقاط.</p>

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
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>العملاء</h3>
          <p className="big">{stats.customers}</p>
        </div>
        <div className="card">
          <h3>المحلات (نشط / إجمالي)</h3>
          <p className="big">
            {stats.activeShops} / {stats.shops}
          </p>
        </div>
        <div className="card">
          <h3>إجمالي النقاط الممنوحة</h3>
          <p className="big">{stats.totalPointsIssued}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>إجمالي المخلفات المجمعة (كجم)</h3>
          <p className="big">{stats.totalWasteKg.toFixed(1)}</p>
        </div>
        <div className="card">
          <h3>إجمالي النقاط المستبدلة</h3>
          <p className="big">{stats.totalRedeemed}</p>
        </div>
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

      {loading ? <p className="muted">جاري التحميل...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="card table-wrap">
        <h3>أفضل العملاء</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>النقاط</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{asNumber(customer.points)}</td>
                <td>{customer.disabled ? "غير مفعل" : "نشط"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!topCustomers.length && !loading ? <p className="muted">لا يوجد عملاء حتى الآن.</p> : null}
      </div>

      <div className="card">
        <h3>المحلات</h3>
        <div className="shops-grid">
          {latestShops.map((shop) => (
            <article className="shop-item" key={shop.id}>
              <img
                src={shop.photo_url || "/icons/icon-192.svg"}
                alt={shop.store_name || shop.name || "محل"}
                className="shop-photo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/icons/icon-192.svg";
                }}
              />
              <div>
                <h4>{shop.store_name || shop.name || "-"}</h4>
                <p className="muted">{shop.phone || "-"}</p>
                <p className="muted">{shop.role === "partner_store" ? "محل شريك" : "محل تجميع"}</p>
              </div>
            </article>
          ))}
        </div>
        {!latestShops.length && !loading ? <p className="muted">لا توجد محلات حالياً.</p> : null}
      </div>
    </section>
  );
}
