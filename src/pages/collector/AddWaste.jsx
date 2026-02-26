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
      setError("Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯");
      return;
    }
    setTargetUser(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    if (!targetUser) return setError("Ø§Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø£ÙˆÙ„Ø§Ù‹");
    if (!selectedType) return setError("Ø§Ø®ØªØ± Ù†ÙˆØ¹ Ù…Ø®Ù„ÙØ©");

    const weight = Number(form.weightKg);
    if (!weight || weight <= 0) return setError("Ø£Ø¯Ø®Ù„ ÙˆØ²Ù† ØµØ­ÙŠØ­");

    const { data: rpcData, error: rpcErr } = await supabase.rpc("award_waste_points", {
      p_user_id: targetUser.id,
      p_waste_type_id: selectedType.id,
      p_weight_kg: weight
    });
    if (rpcErr) return setError(rpcErr.message);

    const awarded = rpcData?.[0]?.points_awarded ?? calcPoints;

    setMsg("ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø¹Ù…Ù„ÙŠØ© ÙˆØªØ­Ø¯ÙŠØ« Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…");
    setTargetUser((p) => ({ ...p, points: Number(p.points || 0) + Number(awarded || 0) }));
    setForm((p) => ({ ...p, weightKg: "" }));
  };

  return (
    <section className="page">
      <h1>Ø¥Ø¶Ø§ÙØ© Ø¹Ù…Ù„ÙŠØ© Ù…Ø®Ù„ÙØ§Øª</h1>
      <div className="card split">
        <div>
          <label>Ø±Ù‚Ù… ØªÙ„ÙŠÙÙˆÙ† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn" onClick={findUser}>
          Ø¨Ø­Ø«
        </button>
      </div>

      {targetUser ? (
        <div className="card">
          <p>Ø§Ù„Ø§Ø³Ù…: {targetUser.name}</p>
          <p>Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø­Ø§Ù„ÙŠ: {targetUser.points} Ù†Ù‚Ø·Ø©</p>
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label>
          Ù†ÙˆØ¹ Ø§Ù„Ù…Ø®Ù„ÙØ©
          <select value={form.wasteTypeId} onChange={(e) => setForm((p) => ({ ...p, wasteTypeId: e.target.value }))} required>
            <option value="">Ø§Ø®ØªØ±...</option>
            {wasteTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon} {w.name} ({w.points_per_kg} Ù†Ù‚Ø·Ø©/ÙƒØ¬Ù…)
              </option>
            ))}
          </select>
        </label>
        <label>
          Ø§Ù„ÙˆØ²Ù† (ÙƒØ¬Ù…)
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
          Ø§Ù„Ù†Ù‚Ø§Ø· Ø§Ù„Ù…Ø­Ø³ÙˆØ¨Ø©: <strong>{calcPoints}</strong>
        </p>
        {msg ? <p className="success">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©
        </button>
      </form>
    </section>
  );
}

