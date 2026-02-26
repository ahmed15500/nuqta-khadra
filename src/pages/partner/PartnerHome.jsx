import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import TransactionList from "../../components/TransactionList";

const hasMissingSenderColumn = (error) =>
  String(error?.message || "").toLowerCase().includes("sender_name") ||
  String(error?.message || "").toLowerCase().includes("sender_phone");

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

export default function PartnerHome() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      let { data, error } = await supabase
        .from("point_transfers")
        .select("id, from_id, points, transfer_type, created_at, sender_name, sender_phone")
        .eq("to_id", profile.id)
        .eq("transfer_type", "user_to_store")
        .order("created_at", { ascending: false });

      if (error && hasMissingSenderColumn(error)) {
        const fallback = await supabase
          .from("point_transfers")
          .select("id, from_id, points, transfer_type, created_at")
          .eq("to_id", profile.id)
          .eq("transfer_type", "user_to_store")
          .order("created_at", { ascending: false });

        data = (fallback.data || []).map((x) => ({ ...x, sender_name: "", sender_phone: "" }));
      }

      const list = data || [];
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const totalPoints = list.reduce((s, x) => s + Number(x.points || 0), 0);
      setCount(list.length);
      setTotal(totalPoints);
      setWeeklyTotal(
        list
          .filter((x) => new Date(x.created_at) >= weekStart)
          .reduce((s, x) => s + Number(x.points || 0), 0)
      );

      setRows(
        list.map((x) => ({
          id: x.id,
          type: "استلام",
          details: `العميل: ${x.sender_name || "غير متوفر"} | الهاتف: ${x.sender_phone || "غير متوفر"}`,
          points: `+${formatPoints(x.points)}`,
          created_at: x.created_at
        }))
      );
    };

    load();
  }, [profile?.id]);

  const insights = useMemo(() => {
    const avgPerTransfer = count ? total / count : 0;
    return { avgPerTransfer };
  }, [count, total]);

  return (
    <section className="page">
      <h1>لوحة المحل الشريك</h1>

      <div className="grid-3">
        <div className="card">
          <h3>إجمالي النقاط المستلمة</h3>
          <p className="big">{formatPoints(total)}</p>
        </div>
        <div className="card">
          <h3>عدد التحويلات</h3>
          <p className="big">{count}</p>
        </div>
        <div className="card">
          <h3>نقاط آخر 7 أيام</h3>
          <p className="big">{formatPoints(weeklyTotal)}</p>
        </div>
      </div>

      <div className="card">
        <h2>رؤى سريعة</h2>
        <div className="insights-grid">
          <article className="insight-item">
            <p className="muted">متوسط النقاط لكل تحويل</p>
            <p className="big">{formatPoints(insights.avgPerTransfer)}</p>
            <p className="muted">يعكس متوسط قيمة التحويلات الواردة إلى المحل.</p>
          </article>
          <article className="insight-item">
            <p className="muted">اسم المحل</p>
            <p className="big">{profile?.store_name || profile?.name || "-"}</p>
            <p className="muted">تأكد من تحديث بيانات المحل من لوحة الإدارة.</p>
          </article>
        </div>
      </div>

      <h2>سجل تحويلات العملاء</h2>
      <TransactionList rows={rows} emptyText="لا توجد تحويلات نقاط حتى الآن." />
    </section>
  );
}
