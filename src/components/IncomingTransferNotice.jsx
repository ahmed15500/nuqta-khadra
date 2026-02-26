import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const AUTO_HIDE_MS = 9000;
const MAX_ITEMS = 4;

const hasMissingSenderColumn = (error) =>
  String(error?.message || "").toLowerCase().includes("sender_name") ||
  String(error?.message || "").toLowerCase().includes("sender_phone");

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const buildMessage = (row) => {
  const sender = row.sender_name || row.sender_phone || "مستخدم";
  return `استلمت ${formatPoints(row.points)} نقطة من ${sender}`;
};

export default function IncomingTransferNotice() {
  const { profile, refreshProfile } = useAuth();
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const removeItem = (id) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timersRef.current.delete(id);
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const pushItem = (row) => {
    if (!row?.id) return;

    const nextItem = {
      id: row.id,
      message: buildMessage(row),
      createdAt: row.created_at || new Date().toISOString()
    };

    setItems((prev) => [nextItem, ...prev.filter((x) => x.id !== row.id)].slice(0, MAX_ITEMS));

    const oldTimer = timersRef.current.get(row.id);
    if (oldTimer) clearTimeout(oldTimer);
    const timerId = setTimeout(() => removeItem(row.id), AUTO_HIDE_MS);
    timersRef.current.set(row.id, timerId);
  };

  useEffect(() => {
    if (!profile?.id) return;

    const lastSeenKey = `nuqta_last_seen_transfer_${profile.id}`;
    const nowIso = new Date().toISOString();
    const lastSeen = localStorage.getItem(lastSeenKey);

    let isMounted = true;
    const seenAt = lastSeen || nowIso;
    if (!lastSeen) {
      localStorage.setItem(lastSeenKey, nowIso);
    }

    const loadMissedTransfers = async () => {
      try {
        let { data, error } = await supabase
          .from("point_transfers")
          .select("id, points, created_at, sender_name, sender_phone")
          .eq("to_id", profile.id)
          .gt("created_at", seenAt)
          .order("created_at", { ascending: true })
          .limit(20);

        if (error && hasMissingSenderColumn(error)) {
          const fallback = await supabase
            .from("point_transfers")
            .select("id, points, created_at")
            .eq("to_id", profile.id)
            .gt("created_at", seenAt)
            .order("created_at", { ascending: true })
            .limit(20);

          data = (fallback.data || []).map((x) => ({ ...x, sender_name: "", sender_phone: "" }));
        }

        if (!isMounted || !data?.length) return;

        data.forEach((row) => pushItem(row));
        localStorage.setItem(lastSeenKey, data[data.length - 1].created_at || nowIso);
        await refreshProfile();
      } catch {
        // Ignore transient notification loading errors.
      }
    };

    loadMissedTransfers();

    const channel = supabase
      .channel(`incoming-transfer-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "point_transfers",
          filter: `to_id=eq.${profile.id}`
        },
        async (payload) => {
          const row = payload.new || {};
          pushItem(row);
          localStorage.setItem(lastSeenKey, row.created_at || new Date().toISOString());
          await refreshProfile();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      timersRef.current.forEach((timerId) => clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, [profile?.id, refreshProfile]);

  if (!profile?.id || !items.length) return null;

  return (
    <section className="incoming-transfer-stack" aria-live="polite" role="status">
      {items.map((item) => (
        <article className="incoming-transfer-toast" key={item.id}>
          <div className="incoming-transfer-copy">
            <strong>وصلت نقاط جديدة</strong>
            <p>{item.message}</p>
            <small className="muted">{new Date(item.createdAt).toLocaleString("ar-EG")}</small>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => removeItem(item.id)}
            aria-label="إغلاق الإشعار"
          >
            إغلاق
          </button>
        </article>
      ))}
    </section>
  );
}
