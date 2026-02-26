import { useEffect, useMemo, useState } from "react";
import TransactionList from "../../components/TransactionList";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const wasteTips = [
  {
    title: "افصل المخلفات من المصدر",
    text: "خصص كيس للبلاستيك، وآخر للورق والكرتون، وكيس للمخلفات العضوية لتسهل إعادة التدوير."
  },
  {
    title: "اغسل العبوات قبل التسليم",
    text: "زجاجات المياه وعبوات المنظفات تُقبل أسرع عند تنظيفها وتجفيفها."
  },
  {
    title: "اضغط الحجم لتوفير مساحة",
    text: "اضغط الزجاجات والكرتون قبل التخزين لتجميع كمية أكبر بسهولة."
  },
  {
    title: "تابع أسعار النقاط",
    text: "بعض الأنواع مثل المعادن تعطي نقاطًا أعلى؛ افصلها جيدًا لزيادة رصيدك."
  }
];

export default function UserHome() {
  const { profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      await refreshProfile();

      const { data: waste } = await supabase
        .from("waste_transactions")
        .select("id, points_awarded, created_at, waste_types(name)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: sent } = await supabase
        .from("point_transfers")
        .select("id, points, transfer_type, created_at")
        .eq("from_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: received } = await supabase
        .from("point_transfers")
        .select("id, points, transfer_type, created_at")
        .eq("to_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const mapped = [
        ...(waste || []).map((x) => ({
          id: `w-${x.id}`,
          type: "مخلفات",
          details: x.waste_types?.name || "-",
          points: `+${x.points_awarded}`,
          created_at: x.created_at
        })),
        ...(sent || []).map((x) => ({
          id: `s-${x.id}`,
          type: "تحويل صادر",
          details: x.transfer_type,
          points: `-${x.points}`,
          created_at: x.created_at
        })),
        ...(received || []).map((x) => ({
          id: `r-${x.id}`,
          type: "تحويل وارد",
          details: x.transfer_type,
          points: `+${x.points}`,
          created_at: x.created_at
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setRows(mapped.slice(0, 20));
    };

    load();
  }, [profile?.id]);

  const todayTransactions = useMemo(() => {
    const today = new Date().toDateString();
    return rows.filter((x) => new Date(x.created_at).toDateString() === today).length;
  }, [rows]);

  return (
    <section className="page">
      <h1>لوحة المستخدم</h1>

      <div className="card hero-card">
        <div>
          <p className="muted">رصيدك الحالي</p>
          <p className="big">{profile?.points || 0} نقطة</p>
        </div>
        <div className="hero-stats">
          <div>
            <span>معاملات اليوم</span>
            <strong>{todayTransactions}</strong>
          </div>
          <div>
            <span>إجمالي آخر النشاطات</span>
            <strong>{rows.length}</strong>
          </div>
        </div>
      </div>

      <div className="info-head">
        <h2>إرشادات إدارة المخلفات</h2>
        <p className="muted">نصائح عملية تساعدك تزوّد نقاطك وتحافظ على بيئة أنظف.</p>
      </div>

      <div className="tips-grid">
        {wasteTips.map((tip) => (
          <article className="card tip-card" key={tip.title}>
            <h3>{tip.title}</h3>
            <p>{tip.text}</p>
          </article>
        ))}
      </div>

      <h2>آخر المعاملات</h2>
      <TransactionList rows={rows} />
    </section>
  );
}
