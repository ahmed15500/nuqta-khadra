import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AddWaste() {
  const [wasteTypes, setWasteTypes] = useState([]);
  const [phone, setPhone] = useState("");
  const [targetUser, setTargetUser] = useState(null);
  const [form, setForm] = useState({ wasteTypeId: "", weightKg: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("waste_types").select("id,name,points_per_kg,icon").then(({ data }) => {
      setWasteTypes(data || []);
    });
  }, []);

  const selectedType = useMemo(() => wasteTypes.find((w) => w.id === form.wasteTypeId), [wasteTypes, form.wasteTypeId]);

  const calcPoints = useMemo(() => {
    const weight = Number(form.weightKg || 0);
    const rate = Number(selectedType?.points_per_kg || 0);
    return Math.max(0, Math.round(weight * rate));
  }, [form.weightKg, selectedType]);

  const findUser = async () => {
    setMsg("");
    setError("");
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("id,name,phone,points,role")
      .eq("phone", phone)
      .eq("role", "user")
      .single();

    if (qErr) {
      setTargetUser(null);
      setError("المستخدم غير موجود");
      return;
    }
    setTargetUser(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    if (!targetUser) return setError("ابحث عن المستخدم أولاً");
    if (!selectedType) return setError("اختر نوع مخلفة");

    const weight = Number(form.weightKg);
    if (!weight || weight <= 0) return setError("أدخل وزن صحيح");

    const { data: rpcData, error: rpcErr } = await supabase.rpc("award_waste_points", {
      p_user_id: targetUser.id,
      p_waste_type_id: selectedType.id,
      p_weight_kg: weight
    });
    if (rpcErr) return setError(rpcErr.message);

    const awarded = rpcData?.[0]?.points_awarded ?? calcPoints;

    setMsg("تمت إضافة العملية وتحديث رصيد المستخدم");
    setTargetUser((p) => ({ ...p, points: (p.points || 0) + awarded }));
    setForm((p) => ({ ...p, weightKg: "" }));
  };

  return (
    <section className="page">
      <h1>إضافة عملية مخلفات</h1>
      <div className="card split">
        <div>
          <label>رقم تليفون المستخدم</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn" onClick={findUser}>
          بحث
        </button>
      </div>

      {targetUser ? (
        <div className="card">
          <p>الاسم: {targetUser.name}</p>
          <p>الرصيد الحالي: {targetUser.points} نقطة</p>
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label>
          نوع المخلفة
          <select value={form.wasteTypeId} onChange={(e) => setForm((p) => ({ ...p, wasteTypeId: e.target.value }))} required>
            <option value="">اختر...</option>
            {wasteTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon} {w.name} ({w.points_per_kg} نقطة/كجم)
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
        <p>
          النقاط المحسوبة: <strong>{calcPoints}</strong>
        </p>
        {msg ? <p className="success">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          تأكيد العملية
        </button>
      </form>
    </section>
  );
}
