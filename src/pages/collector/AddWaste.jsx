import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const normalizeArabicDigits = (value) =>
  String(value || "").replace(/[\u0660-\u0669]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)));

const sanitizePhone = (value) => normalizeArabicDigits(value).replace(/[^0-9+]/g, "");

export default function AddWaste() {
  const [wasteTypes, setWasteTypes] = useState([]);
  const [phone, setPhone] = useState("");
  const [targetUser, setTargetUser] = useState(null);
  const [form, setForm] = useState({ wasteTypeId: "", weightKg: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("waste_types")
      .select("id,name,points_per_kg,icon")
      .order("name")
      .then(({ data }) => setWasteTypes(data || []));
  }, []);

  const selectedType = useMemo(
    () => wasteTypes.find((w) => w.id === form.wasteTypeId),
    [wasteTypes, form.wasteTypeId]
  );

  const calcPoints = useMemo(() => {
    const weight = Number(form.weightKg || 0);
    const rate = Number(selectedType?.points_per_kg || 0);
    return Math.max(0, Math.round(weight * rate));
  }, [form.weightKg, selectedType]);

  const findUser = async () => {
    setMsg("");
    setError("");
    setTargetUser(null);

    const normalizedPhone = sanitizePhone(phone);
    if (!normalizedPhone) {
      setError("أدخل رقم هاتف صحيح أولاً.");
      return;
    }

    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("id,name,phone,points,role")
      .eq("phone", normalizedPhone)
      .eq("role", "user")
      .maybeSingle();

    if (qErr || !data) {
      setError("لا يوجد مستخدم بهذا الرقم.");
      return;
    }

    setTargetUser(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    if (!targetUser) return setError("ابحث عن المستخدم أولاً.");
    if (!selectedType) return setError("اختر نوع المخلفات.");

    const weight = Number(form.weightKg);
    if (!Number.isFinite(weight) || weight <= 0) return setError("أدخل وزن صحيح أكبر من صفر.");

    setLoading(true);
    const { data: rpcData, error: rpcErr } = await supabase.rpc("award_waste_points", {
      p_user_id: targetUser.id,
      p_waste_type_id: selectedType.id,
      p_weight_kg: weight
    });
    setLoading(false);

    if (rpcErr) return setError(rpcErr.message || "تعذر تسجيل العملية.");

    const awarded = rpcData?.[0]?.points_awarded ?? calcPoints;
    setMsg(`تمت إضافة العملية بنجاح. النقاط المضافة: ${awarded}`);
    setTargetUser((p) => ({ ...p, points: Number(p.points || 0) + Number(awarded || 0) }));
    setForm((p) => ({ ...p, weightKg: "" }));
  };

  return (
    <section className="page">
      <h1>إضافة عملية مخلفات</h1>

      <div className="card split">
        <div style={{ flex: 1 }}>
          <label>رقم هاتف المستخدم</label>
          <input value={phone} onChange={(e) => setPhone(sanitizePhone(e.target.value))} placeholder="مثال: 01012345678" />
        </div>
        <button className="btn" onClick={findUser}>
          بحث
        </button>
      </div>

      {targetUser ? (
        <div className="card">
          <p>
            <strong>المستخدم:</strong> {targetUser.name || "-"}
          </p>
          <p className="muted">الهاتف: {targetUser.phone || "-"}</p>
          <p className="muted">الرصيد الحالي: {targetUser.points || 0} نقطة</p>
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label>
          نوع المخلفات
          <select
            value={form.wasteTypeId}
            onChange={(e) => setForm((p) => ({ ...p, wasteTypeId: e.target.value }))}
            required
          >
            <option value="">اختر النوع...</option>
            {wasteTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon ? `${w.icon} ` : ""}
                {w.name} ({w.points_per_kg} نقطة/كجم)
              </option>
            ))}
          </select>
        </label>

        <label>
          الوزن (كجم)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={form.weightKg}
            onChange={(e) => setForm((p) => ({ ...p, weightKg: e.target.value }))}
            required
          />
        </label>

        <div className="points-preview">
          <span className="muted">النقاط المحسوبة</span>
          <strong>{calcPoints}</strong>
        </div>

        {msg ? <p className="success">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "جاري الحفظ..." : "تأكيد العملية"}
        </button>
      </form>
    </section>
  );
}
