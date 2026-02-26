import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const initialForm = {
  name: "",
  icon: "",
  pointsPerKg: ""
};

const asNumber = (value) => Number(value ?? 0);

export default function ManagePrices() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("waste_types")
      .select("id,name,icon,points_per_kg,updated_at")
      .order("name");

    setLoading(false);

    if (loadError) {
      setError(loadError.message || "تعذر تحميل أنواع المخلفات.");
      return;
    }

    setTypes(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const totalTypes = types.length;
    const avgPoints = totalTypes ? types.reduce((sum, row) => sum + asNumber(row.points_per_kg), 0) / totalTypes : 0;
    return { totalTypes, avgPoints };
  }, [types]);

  const addType = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const name = form.name.trim();
    const pointsPerKg = Number(form.pointsPerKg);
    const icon = form.icon.trim();

    if (!name) return setError("اسم نوع المخلف مطلوب.");
    if (!Number.isFinite(pointsPerKg) || pointsPerKg < 0) return setError("السعر يجب أن يكون رقمًا أكبر أو يساوي صفر.");

    const duplicated = types.some((t) => String(t.name || "").trim().toLowerCase() === name.toLowerCase());
    if (duplicated) return setError("هذا النوع موجود بالفعل. يمكنك تعديله من القائمة بالأسفل.");

    setSubmitting(true);

    const { error: addError } = await supabase.from("waste_types").insert({
      name,
      icon: icon || null,
      points_per_kg: pointsPerKg,
      updated_at: new Date().toISOString()
    });

    setSubmitting(false);

    if (addError) {
      setError(addError.message || "تعذر إضافة نوع المخلف.");
      return;
    }

    setMsg("تمت إضافة نوع المخلف بنجاح.");
    setForm(initialForm);
    await load();
  };

  const savePrice = async (id, value) => {
    setMsg("");
    setError("");

    const pointsPerKg = Number(value);
    if (!Number.isFinite(pointsPerKg) || pointsPerKg < 0) return setError("لا يمكن وضع قيمة سالبة.");

    setBusyId(id);

    const { error: upErr } = await supabase
      .from("waste_types")
      .update({ points_per_kg: pointsPerKg, updated_at: new Date().toISOString() })
      .eq("id", id);

    setBusyId("");

    if (upErr) {
      setError(upErr.message || "تعذر تحديث السعر.");
      return;
    }

    setMsg("تم تحديث النوع بنجاح.");
    await load();
  };

  return (
    <section className="page">
      <h1>إدارة المخلفات والأسعار</h1>
      <p className="muted">اختر النوع واضغط عليه للتعديل مباشرة بدون جداول طويلة.</p>

      <div className="grid-2">
        <div className="card">
          <h3>إجمالي الأنواع</h3>
          <p className="big">{summary.totalTypes}</p>
        </div>
        <div className="card">
          <h3>متوسط النقاط/كجم</h3>
          <p className="big">{summary.avgPoints.toFixed(1)}</p>
        </div>
      </div>

      <form className="card" onSubmit={addType}>
        <h3>إضافة نوع جديد</h3>
        <div className="grid-3">
          <label>
            اسم النوع
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: مخلفات إلكترونية"
              required
            />
          </label>
          <label>
            الأيقونة (اختياري)
            <input
              value={form.icon}
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="مثال: 🔋"
            />
          </label>
          <label>
            نقاط/كجم
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.pointsPerKg}
              onChange={(e) => setForm((p) => ({ ...p, pointsPerKg: e.target.value }))}
              placeholder="مثال: 4.5"
              required
            />
          </label>
        </div>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "جاري الإضافة..." : "إضافة النوع"}
        </button>
      </form>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">جاري التحميل...</p> : null}

      <div className="card">
        <h3>تعديل الأنواع الحالية</h3>
        <div className="waste-edit-list">
          {types.map((item) => (
            <WasteEditItem key={item.id} item={item} busy={busyId === item.id} onSave={savePrice} />
          ))}
        </div>
        {!types.length && !loading ? <p className="muted">لا توجد أنواع مسجلة حتى الآن.</p> : null}
      </div>
    </section>
  );
}

function WasteEditItem({ item, busy, onSave }) {
  const [value, setValue] = useState(item.points_per_kg);

  useEffect(() => {
    setValue(item.points_per_kg);
  }, [item.points_per_kg]);

  return (
    <details className="waste-edit-item">
      <summary>
        <span className="waste-edit-title">
          {item.icon ? `${item.icon} ` : ""}
          {item.name}
        </span>
        <span className="waste-edit-rate">{item.points_per_kg} نقطة/كجم</span>
      </summary>

      <div className="waste-edit-body">
        <label>
          السعر الجديد (نقطة/كجم)
          <input
            className="cell-input"
            type="number"
            step="0.1"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
        </label>
        <p className="muted">آخر تحديث: {item.updated_at ? new Date(item.updated_at).toLocaleString("ar-EG") : "-"}</p>
        <button className="btn btn-small" onClick={() => onSave(item.id, value)} disabled={busy}>
          {busy ? "جاري الحفظ..." : "حفظ التعديل"}
        </button>
      </div>
    </details>
  );
}
