import { useEffect, useMemo, useState } from "react";
import { rpcWithArgFallback, supabase } from "../../lib/supabase";

const asNumber = (value) => Number(value ?? 0);

export default function ManageTransactions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRowId, setBusyRowId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const [{ data: tx, error: txErr }, { data: profiles, error: pfErr }, { data: types, error: wtErr }] =
      await Promise.all([
        supabase
          .from("waste_transactions")
          .select("id, collector_store_id, user_id, waste_type_id, weight_kg, points_awarded, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("id,name,phone,store_name"),
        supabase.from("waste_types").select("id,name,points_per_kg")
      ]);

    setLoading(false);

    const firstError = txErr || pfErr || wtErr;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const typeMap = new Map((types || []).map((t) => [t.id, t]));

    const nextRows = (tx || []).map((t) => {
      const user = profileMap.get(t.user_id);
      const collector = profileMap.get(t.collector_store_id);
      const wasteType = typeMap.get(t.waste_type_id);

      return {
        ...t,
        userLabel: `${user?.name || "-"} (${user?.phone || "-"})`,
        collectorLabel: collector?.store_name || collector?.name || "-",
        wasteLabel: wasteType?.name || "-",
        editWeightKg: String(t.weight_kg ?? ""),
        editPoints: String(t.points_awarded ?? "")
      };
    });

    setRows(nextRows);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        weight: acc.weight + asNumber(row.weight_kg),
        points: acc.points + asNumber(row.points_awarded)
      }),
      { weight: 0, points: 0 }
    );
  }, [rows]);

  const patchRow = (id, patch) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const saveRow = async (row) => {
    setMsg("");
    setError("");

    const nextWeight = Number(row.editWeightKg);
    const nextPoints = Number(row.editPoints);

    if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
      return setError("الوزن يجب ان يكون اكبر من صفر");
    }

    if (!Number.isInteger(nextPoints) || nextPoints < 0) {
      return setError("النقاط يجب ان تكون رقم صحيح اكبر او يساوي صفر");
    }

    setBusyRowId(row.id);

    const { error: rpcErr } = await rpcWithArgFallback("admin_adjust_waste_transaction", [
      {
        p_transaction_id: row.id,
        p_weight_kg: nextWeight,
        p_points_awarded: nextPoints
      },
      {
        transaction_id: row.id,
        weight_kg: nextWeight,
        points_awarded: nextPoints
      }
    ]);

    setBusyRowId("");

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setMsg("تم تعديل المعاملة");
    await load();
  };

  const deleteRow = async (row) => {
    setMsg("");
    setError("");

    if (!window.confirm("تأكيد حذف المعاملة؟ سيتم خصم نقاطها من رصيد المستخدم.")) return;

    setBusyRowId(row.id);

    const { error: rpcErr } = await rpcWithArgFallback("admin_delete_waste_transaction", [
      { p_transaction_id: row.id },
      { transaction_id: row.id },
      { id: row.id }
    ]);

    setBusyRowId("");

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    setMsg("تم حذف المعاملة");
    setRows((prev) => prev.filter((x) => x.id !== row.id));
  };

  return (
    <section className="page">
      <h1>ادارة معاملات الجمع</h1>
      <p className="muted">
        يمكنك تعديل الوزن او النقاط لاي معاملة، او حذفها بالكامل. يتم تحديث رصيد المستخدم تلقائيا.
      </p>

      <div className="grid-2">
        <div className="card">
          <h3>عدد المعاملات المعروضة</h3>
          <p>{rows.length}</p>
        </div>
        <div className="card">
          <h3>اجمالي النقاط المعروضة</h3>
          <p>{totals.points}</p>
        </div>
      </div>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">جارى التحميل...</p> : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>محل الجمع</th>
              <th>المستخدم</th>
              <th>نوع المخلف</th>
              <th>الوزن (كجم)</th>
              <th>النقاط</th>
              <th>اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const disabled = busyRowId === row.id;
              return (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ar-EG")}</td>
                  <td>{row.collectorLabel}</td>
                  <td>{row.userLabel}</td>
                  <td>{row.wasteLabel}</td>
                  <td>
                    <input
                      className="cell-input"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={row.editWeightKg}
                      onChange={(e) => patchRow(row.id, { editWeightKg: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      type="number"
                      step="1"
                      min="0"
                      value={row.editPoints}
                      onChange={(e) => patchRow(row.id, { editPoints: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="actions-cell">
                    <button className="btn btn-small" onClick={() => saveRow(row)} disabled={disabled}>
                      حفظ
                    </button>
                    <button className="btn btn-outline btn-small" onClick={() => deleteRow(row)} disabled={disabled}>
                      حذف
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && !loading ? <p className="muted">لا توجد معاملات</p> : null}
      </div>
    </section>
  );
}
