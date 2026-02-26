import { useEffect, useMemo, useState } from "react";
import TransactionList from "../../components/TransactionList";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

export default function CollectorHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ count: 0, totalKg: 0, totalPoints: 0, todayCount: 0 });
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      const { data } = await supabase
        .from("waste_transactions")
        .select("id, weight_kg, points_awarded, created_at, waste_types(name)")
        .eq("collector_store_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const list = data || [];
      const today = new Date().toDateString();

      setRows(
        list.map((item) => ({
          id: item.id,
          type: "مخلفات",
          details: `${item.waste_types?.name || "نوع"} - ${item.weight_kg} كجم`,
          points: `+${item.points_awarded}`,
          created_at: item.created_at
        }))
      );

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
          <h3>عدد العمليات</h3>
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
            <p className="muted">عدد العمليات التي تمت اليوم في المحل.</p>
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
