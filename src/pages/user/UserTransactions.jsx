import { useEffect, useMemo, useState } from "react";
import TransactionList from "../../components/TransactionList";
import { useAuth } from "../../contexts/AuthContext";
import { roles, supabase } from "../../lib/supabase";

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

export default function UserTransactions() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: waste, error: wasteErr } = await supabase
          .from("waste_transactions")
          .select("id, points_awarded, created_at, waste_types(name)")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(250);
        if (wasteErr) throw wasteErr;

        const { data: sent, error: sentErr } = await supabase
          .from("point_transfers")
          .select("id, to_id, points, transfer_type, created_at")
          .eq("from_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(250);
        if (sentErr) throw sentErr;

        const { data: received, error: receivedErr } = await supabase
          .from("point_transfers")
          .select("id, from_id, points, transfer_type, created_at, sender_name, sender_phone")
          .eq("to_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(250);
        if (receivedErr) throw receivedErr;

        const peerIds = unique(
          [
            ...((sent || []).map((x) => x.to_id).filter(Boolean) || []),
            ...((received || []).map((x) => x.from_id).filter(Boolean) || [])
          ].filter((id) => id !== profile.id)
        );

        let peersById = {};
        if (peerIds.length) {
          const { data: peers, error: peersErr } = await supabase
            .from("profiles")
            .select("id, name, phone, store_name, role")
            .in("id", peerIds);
          if (peersErr) throw peersErr;

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

        setRows(mapped);
      } catch (err) {
        setError(err?.message || "تعذر تحميل المعاملات.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.id]);

  const stats = useMemo(() => {
    const wasteCount = rows.filter((x) => String(x.id).startsWith("w-")).length;
    const sentCount = rows.filter((x) => String(x.id).startsWith("s-")).length;
    const receivedCount = rows.filter((x) => String(x.id).startsWith("r-")).length;
    return { wasteCount, sentCount, receivedCount };
  }, [rows]);

  return (
    <section className="page">
      <h1>المعاملات</h1>

      <div className="card">
        <p className="muted">إجمالي المعاملات: {rows.length}</p>
        <p className="muted">
          عمليات جمع: {stats.wasteCount} | تحويلات صادرة: {stats.sentCount} | تحويلات واردة:{" "}
          {stats.receivedCount}
        </p>
      </div>

      {loading ? <p className="muted">جاري تحميل المعاملات...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <TransactionList rows={rows} emptyText="لا توجد معاملات بعد." />
    </section>
  );
}
