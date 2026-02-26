import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { roles, rpcWithArgFallback, supabase } from "../../lib/supabase";

const wasteTips = [
  {
    title: "افصل المخلفات من المصدر",
    text: "خصص كيسًا للبلاستيك، وآخر للورق والكرتون، وكيسًا للمخلفات العضوية لتسهيل إعادة التدوير."
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

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const unique = (arr) => [...new Set(arr)];

const roleLabel = (role) => {
  if (role === roles.PARTNER) return "محل شريك";
  if (role === roles.COLLECTOR) return "محل تجميع";
  return "مستخدم";
};

const getTransferTargetLabel = (target) => {
  if (!target) return "غير متاح";
  const base = target.store_name || target.name || target.phone || "غير معروف";
  const phone = target.phone ? ` - ${target.phone}` : "";
  return `${base} (${roleLabel(target.role)})${phone}`;
};

const getTransferSenderLabel = (sender, transferRow) => {
  if (sender) {
    const base = sender.store_name || sender.name || sender.phone || "غير معروف";
    const phone = sender.phone ? ` - ${sender.phone}` : "";
    return `${base} (${roleLabel(sender.role)})${phone}`;
  }

  const fallbackBase = transferRow?.sender_name || transferRow?.sender_phone || "غير معروف";
  const fallbackPhone =
    transferRow?.sender_phone && transferRow?.sender_phone !== transferRow?.sender_name
      ? ` - ${transferRow.sender_phone}`
      : "";
  return `${fallbackBase}${fallbackPhone}`;
};

const leagueTierLabel = (row) => row?.league_name || `League ${row?.league_tier || 1}`;

export default function UserHome() {
  const { profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [leagueRows, setLeagueRows] = useState([]);
  const [leagueError, setLeagueError] = useState("");

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
        .select("id, to_id, points, transfer_type, created_at")
        .eq("from_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: received } = await supabase
        .from("point_transfers")
        .select("id, from_id, points, transfer_type, created_at, sender_name, sender_phone")
        .eq("to_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const leagueRefreshRes = await rpcWithArgFallback("league_refresh_current_scores", [{}, {}]);
      if (leagueRefreshRes.error) {
        setLeagueRows([]);
        setLeagueError(leagueRefreshRes.error.message || "Unable to load weekly league.");
      } else {
        const leagueRes = await rpcWithArgFallback("get_user_league_snapshot", [{}, {}]);
        if (leagueRes.error) {
          setLeagueRows([]);
          setLeagueError(leagueRes.error.message || "Unable to load weekly league.");
        } else {
          setLeagueRows(leagueRes.data || []);
          setLeagueError("");
        }
      }

      const peerIds = unique(
        [
          ...((sent || []).map((x) => x.to_id).filter(Boolean) || []),
          ...((received || []).map((x) => x.from_id).filter(Boolean) || [])
        ].filter((id) => id !== profile.id)
      );

      let peersById = {};
      if (peerIds.length) {
        const { data: peers } = await supabase
          .from("profiles")
          .select("id, name, phone, store_name, role")
          .in("id", peerIds);

        peersById = Object.fromEntries((peers || []).map((p) => [p.id, p]));
      }

      const mapped = [
        ...(waste || []).map((x) => ({
          id: `w-${x.id}`,
          type: "مخلفات",
          details: x.waste_types?.name || "-",
          points: `+${formatPoints(x.points_awarded)}`,
          created_at: x.created_at
        })),
        ...(sent || []).map((x) => ({
          id: `s-${x.id}`,
          type: "تحويل صادر",
          details: `إلى: ${getTransferTargetLabel(peersById[x.to_id])}`,
          points: `-${formatPoints(x.points)}`,
          created_at: x.created_at
        })),
        ...(received || []).map((x) => ({
          id: `r-${x.id}`,
          type: "تحويل وارد",
          details: `من: ${getTransferSenderLabel(peersById[x.from_id], x)}`,
          points: `+${formatPoints(x.points)}`,
          created_at: x.created_at
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setRows(mapped.slice(0, 25));
    };

    load();
  }, [profile?.id]);

  const todayTransactions = useMemo(() => {
    const today = new Date().toDateString();
    return rows.filter((x) => new Date(x.created_at).toDateString() === today).length;
  }, [rows]);

  const insights = useMemo(() => {
    const wasteCount = rows.filter((x) => String(x.id).startsWith("w-")).length;
    const sentCount = rows.filter((x) => String(x.id).startsWith("s-")).length;
    const receivedCount = rows.filter((x) => String(x.id).startsWith("r-")).length;

    const netPoints = rows.reduce((sum, row) => {
      const value = Number(String(row.points).replace("+", "")) || 0;
      return sum + value;
    }, 0);

    const currentPoints = Number(profile?.points || 0);
    const nextGoal = Math.floor(currentPoints / 100) * 100 + 100;
    const remaining = Math.max(0, nextGoal - currentPoints);

    return {
      wasteCount,
      sentCount,
      receivedCount,
      netPoints,
      nextGoal,
      remaining
    };
  }, [rows, profile?.points]);

  const myLeagueEntry = useMemo(() => leagueRows.find((row) => row.is_me), [leagueRows]);
  const leagueTopRows = useMemo(() => leagueRows.slice(0, 8), [leagueRows]);

  return (
    <section className="page">
      <h1>لوحة المستخدم</h1>

      <div className="card hero-card">
        <div>
          <p className="muted">رصيدك الحالي</p>
          <p className="big">{formatPoints(profile?.points || 0)} نقطة</p>
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

      <div className="card">
        <h2>رؤى سريعة</h2>
        <div className="insights-grid">
          <article className="insight-item">
            <p className="muted">الهدف القادم</p>
            <p className="big">{insights.nextGoal} نقطة</p>
            <p className="muted">المتبقي للوصول للهدف: {formatPoints(insights.remaining)} نقطة</p>
          </article>
          <article className="insight-item">
            <p className="muted">صافي الحركة في آخر العمليات</p>
            <p className={`big ${insights.netPoints < 0 ? "points-negative" : "points-positive"}`}>
              {insights.netPoints > 0 ? "+" : ""}
              {formatPoints(insights.netPoints)}
            </p>
            <p className="muted">فرق النقاط المكتسبة مقابل المحولة.</p>
          </article>
          <article className="insight-item">
            <p className="muted">ملخص النشاط</p>
            <p className="big">{insights.wasteCount} عمليات جمع</p>
            <p className="muted">
              تحويلات صادرة: {insights.sentCount} | تحويلات واردة: {insights.receivedCount}
            </p>
          </article>
        </div>
      </div>

      <div className="card">
        <h2>Weekly League</h2>
        {myLeagueEntry ? (
          <>
            <div className="league-summary">
              <span className="league-tier-chip">{leagueTierLabel(myLeagueEntry)}</span>
              <strong>
                Rank #{myLeagueEntry.rank || "-"} | {formatPoints(myLeagueEntry.weekly_points)} pts
              </strong>
              <small>
                Week: {myLeagueEntry.week_start} - {myLeagueEntry.week_end}
              </small>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Weekly Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueTopRows.map((row) => (
                    <tr key={row.profile_id} className={row.is_me ? "league-row-me" : ""}>
                      <td>#{row.rank || "-"}</td>
                      <td>{row.profile_name || "-"}</td>
                      <td>{formatPoints(row.weekly_points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">No weekly league data yet.</p>
        )}

        {leagueError ? <p className="error">{leagueError}</p> : null}
      </div>

      <div className="info-head">
        <h2>إرشادات إدارة المخلفات</h2>
        <p className="muted">نصائح عملية تساعدك تزود نقاطك وتحافظ على بيئة أنظف.</p>
      </div>

      <div className="tips-grid">
        {wasteTips.map((tip) => (
          <article className="card tip-card" key={tip.title}>
            <h3>{tip.title}</h3>
            <p>{tip.text}</p>
          </article>
        ))}
      </div>

    </section>
  );
}
