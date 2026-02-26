import { useEffect, useMemo, useState } from "react";
import TransactionList from "../../components/TransactionList";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const hasMissingSenderColumn = (error) =>
  String(error?.message || "").toLowerCase().includes("sender_name") ||
  String(error?.message || "").toLowerCase().includes("sender_phone");

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

export default function CollectorHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ count: 0, totalKg: 0, totalPoints: 0, todayCount: 0 });
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      const { data } = await supabase
        .from("waste_transactions")
        .select("id, user_id, weight_kg, points_awarded, created_at, waste_types(name)")
        .eq("collector_store_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(40);

      const list = data || [];
      const today = new Date().toDateString();

      const userIds = [...new Set(list.map((x) => x.user_id).filter(Boolean))];
      let usersById = {};
      if (userIds.length) {
        const { data: users } = await supabase.from("profiles").select("id,name,phone").in("id", userIds);
        usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
      }

      let transferRes = await supabase
        .from("point_transfers")
        .select("id, from_id, points, created_at, sender_name, sender_phone")
        .eq("to_id", profile.id)
        .eq("transfer_type", "user_to_store")
        .order("created_at", { ascending: false })
        .limit(40);

      if (transferRes.error && hasMissingSenderColumn(transferRes.error)) {
        transferRes = await supabase
          .from("point_transfers")
          .select("id, from_id, points, created_at")
          .eq("to_id", profile.id)
          .eq("transfer_type", "user_to_store")
          .order("created_at", { ascending: false })
          .limit(40);
      }

      const transferList = (transferRes.data || []).map((x) => ({
        ...x,
        sender_name: x.sender_name || "",
        sender_phone: x.sender_phone || ""
      }));

      const wasteRows = list.map((item) => {
        const user = usersById[item.user_id];
        const userLabel = user ? `${user.name || "-"} (${user.phone || "-"})` : item.user_id || "غير متاح";

        return {
          id: `w-${item.id}`,
          type: "تسجيل مخلفات",
          details: `العميل: ${userLabel} | ${item.waste_types?.name || "نوع"} - ${item.weight_kg} كجم`,
          points: `+${item.points_awarded}`,
          created_at: item.created_at
        };
      });

      const transferRows = transferList.map((item) => {
        const sender = item.sender_name || item.sender_phone || item.from_id || "غير متاح";
        const senderPhone = item.sender_phone && item.sender_phone !== sender ? ` (${item.sender_phone})` : "";

        return {
          id: `t-${item.id}`,
          type: "استلام نقاط",
          details: `من العميل: ${sender}${senderPhone}`,
          points: `+${formatPoints(item.points)}`,
          created_at: item.created_at
        };
      });

      const mergedRows = [...wasteRows, ...transferRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRows(mergedRows.slice(0, 30));

      setStats({
        count: list.length,
        totalKg: list.reduce((s, i) => s + Number(i.weight_kg || 0), 0),
        totalPoints: list.reduce((s, i) => s + Number(i.points_awarded || 0), 0),
        todayCount: list.filter((i) => new Date(i.created_at).toDateString() === today).length
      });
    };

    load();
  }, [profile?.id]);

  const insights = useMemo(() => {
    const avgKgPerOperation = stats.count ? (stats.totalKg / stats.count).toFixed(2) : "0.00";
    const avgPointsPerKg = stats.totalKg ? (stats.totalPoints / stats.totalKg).toFixed(2) : "0.00";
    return { avgKgPerOperation, avgPointsPerKg };
  }, [stats]);

  return (
    <section className="page">
      <h1>لوحة محل التجميع</h1>

      <div className="grid-3">
        <div className="card">
          <h3>عدد عمليات التجميع</h3>
          <p className="big">{stats.count}</p>
        </div>
        <div className="card">
          <h3>إجمالي الوزن</h3>
          <p className="big">{stats.totalKg.toFixed(2)} كجم</p>
        </div>
        <div className="card">
          <h3>إجمالي النقاط الممنوحة</h3>
          <p className="big">{stats.totalPoints}</p>
        </div>
      </div>

      <div className="card">
        <h2>رؤى سريعة</h2>
        <div className="insights-grid">
          <article className="insight-item">
            <p className="muted">نشاط اليوم</p>
            <p className="big">{stats.todayCount} عملية</p>
            <p className="muted">عدد عمليات تسجيل المخلفات اليوم.</p>
          </article>
          <article className="insight-item">
            <p className="muted">متوسط الوزن لكل عملية</p>
            <p className="big">{insights.avgKgPerOperation} كجم</p>
            <p className="muted">يساعدك في متابعة كفاءة الاستلام.</p>
          </article>
          <article className="insight-item">
            <p className="muted">متوسط النقاط لكل كجم</p>
            <p className="big">{insights.avgPointsPerKg}</p>
            <p className="muted">مؤشر سريع على العائد من المخلفات المستلمة.</p>
          </article>
        </div>
      </div>

      <h2>آخر العمليات</h2>
      <TransactionList rows={rows} emptyText="لا توجد عمليات بعد." />
    </section>
  );
}
