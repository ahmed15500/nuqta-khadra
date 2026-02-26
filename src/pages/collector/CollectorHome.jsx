import { useEffect, useState } from "react";
import TransactionList from "../../components/TransactionList";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

export default function CollectorHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ count: 0, totalKg: 0, totalPoints: 0 });
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
      setRows(
        list.map((item) => ({
          id: item.id,
          type: "مخلفات",
          details: `${item.waste_types?.name || "نوع"} - ${item.weight_kg} كجم`,
          points: item.points_awarded,
          created_at: item.created_at
        }))
      );

      setStats({
        count: list.length,
        totalKg: list.reduce((s, i) => s + Number(i.weight_kg || 0), 0),
        totalPoints: list.reduce((s, i) => s + Number(i.points_awarded || 0), 0)
      });
    };

    load();
  }, [profile?.id]);

  return (
    <section className="page">
      <h1>لوحة محل الجمع</h1>
      <div className="grid-3">
        <div className="card">
          <h3>عمليات اليوم/الأخيرة</h3>
          <p>{stats.count}</p>
        </div>
        <div className="card">
          <h3>إجمالي الكيلو</h3>
          <p>{stats.totalKg.toFixed(2)} كجم</p>
        </div>
        <div className="card">
          <h3>إجمالي النقاط الموزعة</h3>
          <p>{stats.totalPoints}</p>
        </div>
      </div>
      <h2>آخر العمليات</h2>
      <TransactionList rows={rows} emptyText="لا توجد عمليات بعد" />
    </section>
  );
}
