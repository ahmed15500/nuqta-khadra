import { useEffect, useMemo, useState } from "react";
import { rpcWithArgFallback, roles, supabase } from "../../lib/supabase";

const SETTLEABLE_ROLES = [roles.USER, roles.PARTNER, roles.COLLECTOR];

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const formatMoney = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const asRoleLabel = (role) => {
  if (role === roles.USER) return "مستخدم";
  if (role === roles.PARTNER) return "محل شريك";
  if (role === roles.COLLECTOR) return "محل تجميع";
  return role || "-";
};

export default function ManageSettlements() {
  const [loading, setLoading] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [rates, setRates] = useState({
    user_cash_per_point: 1,
    shop_cash_per_point: 1,
    updated_at: null
  });

  const load = async () => {
    setLoading(true);
    setError("");

    const [rateRes, profileRes, settlementRes] = await Promise.all([
      supabase.from("point_cash_rates").select("id,user_cash_per_point,shop_cash_per_point,updated_at").eq("id", 1).maybeSingle(),
      supabase
        .from("profiles")
        .select("id,name,phone,role,store_name,points,disabled")
        .in("role", SETTLEABLE_ROLES)
        .order("points", { ascending: false }),
      supabase
        .from("point_settlements")
        .select("id,beneficiary_id,beneficiary_role,points_settled,cash_per_point,cash_amount,paid_by_admin_id,note,created_at")
        .order("created_at", { ascending: false })
        .limit(300)
    ]);

    setLoading(false);

    const firstError = rateRes.error || profileRes.error || settlementRes.error;
    if (firstError) {
      setError(
        firstError.message ||
          "تعذر تحميل بيانات التسوية. تأكد من تشغيل ملفي schema.sql و admin_tools.sql في Supabase."
      );
      return;
    }

    setRates((prev) => ({
      user_cash_per_point: Number(rateRes.data?.user_cash_per_point ?? prev.user_cash_per_point ?? 1),
      shop_cash_per_point: Number(rateRes.data?.shop_cash_per_point ?? prev.shop_cash_per_point ?? 1),
      updated_at: rateRes.data?.updated_at || null
    }));
    setProfiles(profileRes.data || []);
    setSettlements(settlementRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const settlementByProfile = useMemo(() => {
    const map = new Map();
    for (const row of settlements) {
      if (!map.has(row.beneficiary_id)) {
        map.set(row.beneficiary_id, row);
      }
    }
    return map;
  }, [settlements]);

  const visibleProfiles = useMemo(
    () => (profiles || []).filter((p) => Number(p.points || 0) > 0 || settlementByProfile.has(p.id)),
    [profiles, settlementByProfile]
  );

  const rowsWithDue = useMemo(
    () =>
      visibleProfiles.map((p) => {
        const rate = p.role === roles.USER ? Number(rates.user_cash_per_point || 0) : Number(rates.shop_cash_per_point || 0);
        const points = Number(p.points || 0);
        const due = Number((points * rate).toFixed(2));
        return { ...p, rate, due, lastSettlement: settlementByProfile.get(p.id) || null };
      }),
    [visibleProfiles, rates, settlementByProfile]
  );

  const userRows = useMemo(() => rowsWithDue.filter((p) => p.role === roles.USER), [rowsWithDue]);
  const shopRows = useMemo(
    () => rowsWithDue.filter((p) => p.role === roles.PARTNER || p.role === roles.COLLECTOR),
    [rowsWithDue]
  );

  const totals = useMemo(() => {
    const usersDue = userRows.reduce((s, x) => s + Number(x.due || 0), 0);
    const shopsDue = shopRows.reduce((s, x) => s + Number(x.due || 0), 0);
    const paidAll = settlements.reduce((s, x) => s + Number(x.cash_amount || 0), 0);
    return { usersDue, shopsDue, paidAll };
  }, [userRows, shopRows, settlements]);

  const saveRates = async () => {
    setMsg("");
    setError("");

    const userRate = Number(rates.user_cash_per_point);
    const shopRate = Number(rates.shop_cash_per_point);

    if (!Number.isFinite(userRate) || userRate < 0) {
      return setError("سعر نقطة المستخدم يجب أن يكون رقمًا >= 0");
    }
    if (!Number.isFinite(shopRate) || shopRate < 0) {
      return setError("سعر نقطة المحل يجب أن يكون رقمًا >= 0");
    }

    setSavingRates(true);
    const { error: rpcErr } = await rpcWithArgFallback("admin_set_cash_rates", [
      {
        p_user_cash_per_point: userRate,
        p_shop_cash_per_point: shopRate
      },
      {
        user_cash_per_point: userRate,
        shop_cash_per_point: shopRate
      }
    ]);
    setSavingRates(false);

    if (rpcErr) {
      setError(
        rpcErr.message ||
          "تعذر حفظ سعر النقطة. تأكد من تشغيل ملف admin_tools.sql في Supabase."
      );
      return;
    }

    setMsg("تم حفظ أسعار التحويل النقدي بنجاح.");
    await load();
  };

  const settleProfile = async (profileRow) => {
    setMsg("");
    setError("");

    if (Number(profileRow.points || 0) <= 0) {
      setError("لا توجد نقاط حالية لتسويتها.");
      return;
    }

    const note = window.prompt(
      `تسوية حساب ${profileRow.store_name || profileRow.name || profileRow.phone}\nاكتب ملاحظة (اختياري):`,
      ""
    );
    if (note === null) return;

    setBusyProfileId(profileRow.id);
    const { error: rpcErr } = await rpcWithArgFallback("admin_settle_profile_points", [
      {
        p_profile_id: profileRow.id,
        p_note: note || null
      },
      {
        profile_id: profileRow.id,
        note: note || null
      },
      {
        p_profile_id: profileRow.id
      }
    ]);
    setBusyProfileId("");

    if (rpcErr) {
      setError(
        rpcErr.message ||
          "تعذر تنفيذ التسوية. تأكد من تشغيل ملف admin_tools.sql في Supabase."
      );
      return;
    }

    setMsg("تمت التسوية وتصفير الرصيد بنجاح.");
    await load();
  };

  const renderSettlementTable = (title, rows) => (
    <div className="card table-wrap">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الهاتف</th>
            <th>النوع</th>
            <th>النقاط الحالية</th>
            <th>المبلغ المستحق</th>
            <th>آخر تسوية</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.store_name || row.name || "-"}</td>
              <td>{row.phone || "-"}</td>
              <td>{asRoleLabel(row.role)}</td>
              <td>{formatPoints(row.points)}</td>
              <td>{formatMoney(row.due)} جنيه</td>
              <td>{row.lastSettlement ? new Date(row.lastSettlement.created_at).toLocaleString("ar-EG") : "-"}</td>
              <td>
                <button
                  className="btn btn-small"
                  disabled={busyProfileId === row.id || Number(row.points || 0) <= 0}
                  onClick={() => settleProfile(row)}
                >
                  {busyProfileId === row.id ? "جاري..." : "تسوية ودفع"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="muted">لا توجد أرصدة حالية.</p> : null}
    </div>
  );

  return (
    <section className="page">
      <h1>تسوية النقاط إلى أموال</h1>
      <p className="muted">من هنا تقدر تحدد سعر النقطة وتسوي أرصدة العملاء والمحلات مع تسجيل كل عملية دفع.</p>

      <div className="grid-3">
        <div className="card">
          <h3>مستحق المستخدمين</h3>
          <p className="big">{formatMoney(totals.usersDue)} ج</p>
        </div>
        <div className="card">
          <h3>مستحق المحلات</h3>
          <p className="big">{formatMoney(totals.shopsDue)} ج</p>
        </div>
        <div className="card">
          <h3>إجمالي المدفوع سابقًا</h3>
          <p className="big">{formatMoney(totals.paidAll)} ج</p>
        </div>
      </div>

      <div className="card">
        <h3>إعداد سعر النقطة</h3>
        <div className="grid-2">
          <label>
            سعر نقطة المستخدم (جنيه/نقطة)
            <input
              type="number"
              step="0.01"
              min="0"
              value={rates.user_cash_per_point}
              onChange={(e) => setRates((p) => ({ ...p, user_cash_per_point: e.target.value }))}
            />
          </label>
          <label>
            سعر نقطة المحل (جنيه/نقطة)
            <input
              type="number"
              step="0.01"
              min="0"
              value={rates.shop_cash_per_point}
              onChange={(e) => setRates((p) => ({ ...p, shop_cash_per_point: e.target.value }))}
            />
          </label>
        </div>
        <p className="muted">
          آخر تحديث للسعر: {rates.updated_at ? new Date(rates.updated_at).toLocaleString("ar-EG") : "-"}
        </p>
        <button className="btn" onClick={saveRates} disabled={savingRates}>
          {savingRates ? "جاري الحفظ..." : "حفظ الأسعار"}
        </button>
      </div>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">جاري تحميل بيانات التسوية...</p> : null}

      {renderSettlementTable("تسوية المستخدمين", userRows)}
      {renderSettlementTable("تسوية المحلات", shopRows)}

      <div className="card table-wrap">
        <h3>سجل التسويات</h3>
        <table>
          <thead>
            <tr>
              <th>المستفيد</th>
              <th>النوع</th>
              <th>النقاط المسواة</th>
              <th>السعر/نقطة</th>
              <th>المبلغ المدفوع</th>
              <th>التاريخ</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((row) => {
              const profileRow = profiles.find((p) => p.id === row.beneficiary_id);
              return (
                <tr key={row.id}>
                  <td>{profileRow?.store_name || profileRow?.name || profileRow?.phone || row.beneficiary_id}</td>
                  <td>{asRoleLabel(row.beneficiary_role)}</td>
                  <td>{formatPoints(row.points_settled)}</td>
                  <td>{formatMoney(row.cash_per_point)}</td>
                  <td>{formatMoney(row.cash_amount)} ج</td>
                  <td>{new Date(row.created_at).toLocaleString("ar-EG")}</td>
                  <td>{row.note || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!settlements.length ? <p className="muted">لا توجد عمليات تسوية بعد.</p> : null}
      </div>
    </section>
  );
}
