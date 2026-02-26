import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import TransactionList from "../../components/TransactionList";

export default function PartnerHome() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      const { data } = await supabase
        .from("point_transfers")
        .select("id, points, transfer_type, created_at")
        .eq("to_id", profile.id)
        .eq("transfer_type", "user_to_store")
        .order("created_at", { ascending: false });

      const list = data || [];
      setTotal(list.reduce((s, x) => s + Number(x.points || 0), 0));
      setRows(
        list.map((x) => ({
          id: x.id,
          type: "استلام",
          details: "تحويل من مستخدم",
          points: `+${x.points}`,
          created_at: x.created_at
        }))
      );
    };

    load();
  }, [profile?.id]);

  return (
    <section className="page">
      <h1>لوحة المحل الشريك</h1>
      <div className="card">
        <h3>إجمالي النقاط المستلمة</h3>
        <p className="big">{total}</p>
        <p className="muted">{profile?.store_name || profile?.name}</p>
      </div>
      <h2>السجل</h2>
      <TransactionList rows={rows} />
    </section>
  );
}
