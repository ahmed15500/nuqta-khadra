import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { List, Repeat2, Settings2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { roles, rpcWithArgFallback, supabase } from "../../lib/supabase";

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const formatKg = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 1 });
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

const leagueTierLabel = (row) => row?.league_name || `المستوى ${row?.league_tier || 1}`;

const uhStyles = `
.uh-hero { background: linear-gradient(160deg, #22a355, #146c39); border-radius: 28px; padding: 22px 18px 58px; color: #fff; box-shadow: 0 14px 30px rgba(20, 108, 57, .28); }
.uh-hero-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.uh-hero small { opacity: .92; font-size: 13px; font-weight: 700; }
.uh-hero h1 { margin: 4px 0 0; font-size: 24px; font-weight: 900; color: #fff; }
.uh-avatar { width: 52px; height: 52px; border-radius: 50%; background: #fff; color: #146c39; display: grid; place-items: center; font-weight: 900; font-size: 22px; flex-shrink: 0; box-shadow: 0 8px 18px rgba(0,0,0,.18); }
.uh-wallet { background: #fff; border: 1px solid rgba(20,108,57,.14); border-radius: 26px; margin: -40px 6px 14px; padding: 18px; box-shadow: 0 14px 30px rgba(23,61,39,.14); text-align: center; position: relative; }
.uh-wallet small { color: #5c7a67; font-size: 13px; font-weight: 700; }
.uh-pts { font-size: 40px; font-weight: 900; color: #146c39; line-height: 1.15; margin: 2px 0 6px; }
.uh-pts span { font-size: 16px; font-weight: 800; }
.uh-progress { height: 9px; background: #e5f6ec; border-radius: 99px; overflow: hidden; margin: 8px 0 10px; }
.uh-progress i { display: block; height: 100%; background: linear-gradient(90deg, #22a355, #146c39); border-radius: 99px; }
.uh-chip { display: inline-block; background: #e5f6ec; color: #146c39; border-radius: 99px; padding: 6px 14px; font-size: 12.5px; font-weight: 800; }
.uh-bigact { margin: 0 6px 14px; background: #ffb020; color: #4a2f00; border-radius: 22px; padding: 15px 16px; display: flex; align-items: center; gap: 12px; text-decoration: none; box-shadow: 0 12px 24px rgba(255,176,32,.35); }
.uh-bigact .uh-bigact-ic { width: 48px; height: 48px; background: #fff; border-radius: 15px; display: grid; place-items: center; color: #146c39; flex-shrink: 0; }
.uh-bigact strong { display: block; font-size: 16.5px; font-weight: 900; }
.uh-bigact small { display: block; font-weight: 600; font-size: 12px; opacity: .78; margin-top: 2px; }
.uh-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 6px 14px; }
.uh-act { background: #fff; border: 1px solid rgba(20,108,57,.12); border-radius: 20px; padding: 15px 4px; text-align: center; text-decoration: none; color: #173d27; box-shadow: 0 4px 12px rgba(23,61,39,.05); }
.uh-act .uh-act-ic { width: 44px; height: 44px; margin: 0 auto 7px; border-radius: 14px; background: #e5f6ec; color: #146c39; display: grid; place-items: center; }
.uh-act span { font-size: 12.5px; font-weight: 800; display: block; }
.uh-impact { display: flex; gap: 9px; margin: 0 6px 14px; }
.uh-impact > div { flex: 1; background: #e5f6ec; border-radius: 18px; padding: 12px 6px; text-align: center; }
.uh-impact b { color: #146c39; display: block; font-size: 17px; font-weight: 900; }
.uh-impact span { font-size: 11px; color: #5c7a67; font-weight: 700; }
.uh-card { background: #fff; border: 1px solid rgba(20,108,57,.12); border-radius: 22px; margin: 0 6px 14px; padding: 16px; box-shadow: 0 4px 14px rgba(23,61,39,.05); }
.uh-card h2 { margin: 0 0 10px; font-size: 15.5px; font-weight: 900; color: #173d27; }
.uh-my-rank { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; background: #f2f9f4; border: 1px solid rgba(20,108,57,.14); border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; }
.uh-my-rank strong { color: #146c39; }
.uh-tier { background: #146c39; color: #fff; border-radius: 99px; padding: 3px 11px; font-size: 11.5px; font-weight: 800; }
.uh-league-table { width: 100%; border-collapse: collapse; }
.uh-league-table th, .uh-league-table td { text-align: right; padding: 8px 6px; border-bottom: 1px dashed #e3efe7; font-size: 13px; }
.uh-league-table th { color: #5c7a67; font-size: 12px; border-bottom: 1px solid #e3efe7; }
.uh-league-table tr:last-child td { border-bottom: 0; }
.uh-row-me td { background: #fdf6e9; font-weight: 800; color: #146c39; }
.uh-feed { display: flex; flex-direction: column; }
.uh-feed-row { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px dashed #e3efe7; }
.uh-feed-row:last-child { border-bottom: 0; }
.uh-feed-main { min-width: 0; }
.uh-feed-main strong { display: block; font-size: 13.5px; color: #173d27; }
.uh-feed-main small { color: #5c7a67; font-size: 11.5px; }
.uh-feed-points { font-weight: 900; white-space: nowrap; font-size: 13.5px; }
.uh-more { display: inline-block; margin-top: 10px; color: #146c39; font-weight: 800; font-size: 13px; }
`;

export default function UserHome() {
  const { profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [wasteStats, setWasteStats] = useState({ totalKg: 0, count: 0 });
  const [leagueRows, setLeagueRows] = useState([]);
  const [leagueError, setLeagueError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      await refreshProfile();

      const { data: waste } = await supabase
        .from("waste_transactions")
        .select("id, points_awarded, weight_kg, created_at, waste_types(name)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: allWaste } = await supabase
        .from("waste_transactions")
        .select("weight_kg")
        .eq("user_id", profile.id);

      const allWasteList = allWaste || [];
      setWasteStats({
        totalKg: allWasteList.reduce((sum, x) => sum + Number(x.weight_kg || 0), 0),
        count: allWasteList.length
      });

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
        setLeagueError(leagueRefreshRes.error.message || "تعذر تحميل الدوري الأسبوعي.");
      } else {
        const leagueRes = await rpcWithArgFallback("get_user_league_snapshot", [{}, {}]);
        if (leagueRes.error) {
          setLeagueRows([]);
          setLeagueError(leagueRes.error.message || "تعذر تحميل الدوري الأسبوعي.");
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
          details: `${x.waste_types?.name || "-"}${x.weight_kg ? ` — ${formatKg(x.weight_kg)} كجم` : ""}`,
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

  const goal = useMemo(() => {
    const currentPoints = Number(profile?.points || 0);
    const nextGoal = Math.floor(currentPoints / 100) * 100 + 100;
    const remaining = Math.max(0, nextGoal - currentPoints);
    const pct = Math.min(100, Math.round((currentPoints / nextGoal) * 100));
    return { currentPoints, nextGoal, remaining, pct };
  }, [profile?.points]);

  const myLeagueEntry = useMemo(() => leagueRows.find((row) => row.is_me), [leagueRows]);
  const leagueTopRows = useMemo(() => leagueRows.slice(0, 5), [leagueRows]);
  const recentRows = useMemo(() => rows.slice(0, 8), [rows]);

  const firstInitial = (profile?.name || "م").trim().charAt(0) || "م";

  return (
    <section className="page">
      <style>{uhStyles}</style>

      <div className="uh-hero">
        <div className="uh-hero-top">
          <div>
            <small>أهلًا بيك في نقاط خضراء</small>
            <h1>{profile?.name || "مستخدم"} 🌿</h1>
          </div>
          <div className="uh-avatar" aria-hidden="true">
            {firstInitial}
          </div>
        </div>
      </div>

      <div className="uh-wallet">
        <small>معاك دلوقتي</small>
        <div className="uh-pts">
          {formatPoints(profile?.points || 0)} <span>نقطة</span>
        </div>
        <div className="uh-progress">
          <i style={{ width: `${goal.pct}%` }} />
        </div>
        {goal.remaining > 0 ? (
          <span className="uh-chip">
            🎯 باقي {formatPoints(goal.remaining)} نقطة على هدف {formatPoints(goal.nextGoal)}
          </span>
        ) : (
          <span className="uh-chip">🎉 وصلت لهدفك — كمّل للهدف اللي بعده</span>
        )}
      </div>

      <Link className="uh-bigact" to="/user/transfer">
        <span className="uh-bigact-ic">
          <Repeat2 size={24} />
        </span>
        <span>
          <strong>حوّل نقاطك واستبدلها</strong>
          <small>لأي محل شريك أو مستخدم تاني</small>
        </span>
      </Link>

      <div className="uh-actions">
        <Link className="uh-act" to="/user/transfer">
          <span className="uh-act-ic">
            <Repeat2 size={21} />
          </span>
          <span>حوّل نقاط</span>
        </Link>
        <Link className="uh-act" to="/user/transactions">
          <span className="uh-act-ic">
            <List size={21} />
          </span>
          <span>سجلّي</span>
        </Link>
        <Link className="uh-act" to="/user/settings">
          <span className="uh-act-ic">
            <Settings2 size={21} />
          </span>
          <span>حسابي</span>
        </Link>
      </div>

      <div className="uh-impact">
        <div>
          <b>{formatKg(wasteStats.totalKg)} كجم</b>
          <span>مخلفات سلّمتها</span>
        </div>
        <div>
          <b>{wasteStats.count}</b>
          <span>عملية تجميع</span>
        </div>
        <div>
          <b>{myLeagueEntry?.rank ? `#${myLeagueEntry.rank}` : "—"}</b>
          <span>ترتيبك في الدوري</span>
        </div>
      </div>

      <div className="uh-card">
        <h2>🏆 دوري الأسبوع</h2>
        {myLeagueEntry ? (
          <>
            <div className="uh-my-rank">
              <span className="uh-tier">{leagueTierLabel(myLeagueEntry)}</span>
              <strong>
                ترتيبك #{myLeagueEntry.rank || "-"} · {formatPoints(myLeagueEntry.weekly_points)} نقطة هذا الأسبوع
              </strong>
            </div>
            <table className="uh-league-table">
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>الاسم</th>
                  <th>النقاط</th>
                </tr>
              </thead>
              <tbody>
                {leagueTopRows.map((row) => (
                  <tr key={row.profile_id} className={row.is_me ? "uh-row-me" : ""}>
                    <td>#{row.rank || "-"}</td>
                    <td>{row.profile_name || "-"}</td>
                    <td>{formatPoints(row.weekly_points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            لسه مفيش بيانات للدوري الأسبوعي.
          </p>
        )}
        {leagueError ? <p className="error">{leagueError}</p> : null}
      </div>

      <div className="uh-card">
        <h2>آخر نشاط</h2>
        {recentRows.length ? (
          <div className="uh-feed">
            {recentRows.map((row) => (
              <div className="uh-feed-row" key={row.id}>
                <div className="uh-feed-main">
                  <strong>
                    {row.type} · {row.details}
                  </strong>
                  <small>{new Date(row.created_at).toLocaleDateString("ar-EG")}</small>
                </div>
                <span
                  className="uh-feed-points"
                  style={{ color: String(row.points).startsWith("-") ? "#c0392b" : "#1d8a49" }}
                >
                  {row.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            لسه مفيش نشاط — سلّم أول مخلفاتك واكسب نقاط.
          </p>
        )}
        <Link className="uh-more" to="/user/transactions">
          عرض كل المعاملات ←
        </Link>
      </div>
    </section>
  );
}
