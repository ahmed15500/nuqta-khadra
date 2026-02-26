import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { roles, supabase } from "../../lib/supabase";

export default function Transfer() {
  const { profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState("user");
  const [phone, setPhone] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [points, setPoints] = useState("");
  const [partners, setPartners] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPartners = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, store_name, phone, role, disabled")
        .eq("role", roles.PARTNER)
        .eq("disabled", false)
        .order("store_name", { ascending: true });

      setPartners(data || []);
    };

    loadPartners();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      const amount = Number(points);
      if (!amount || amount <= 0) return setError("ادخل عدد نقاط صحيح");
      if (amount > (profile?.points || 0)) return setError("لا يمكن تحويل اكثر من الرصيد");

      let target = null;
      let transferType = "user_to_user";

      if (mode === "user") {
        const { data, error: findErr } = await supabase
          .from("profiles")
          .select("id, role, name, store_name, phone")
          .eq("phone", phone)
          .eq("role", roles.USER)
          .maybeSingle();

        if (findErr) return setError(findErr.message || "فشل البحث عن الحساب");
        if (!data) return setError("المستخدم غير موجود");
        target = data;
        transferType = "user_to_user";
      } else {
        if (!partnerId) return setError("اختر محل شريك من القائمة");
        target = partners.find((p) => p.id === partnerId) || null;
        if (!target) return setError("المحل الشريك غير متاح");
        transferType = "user_to_store";
      }

      if (target.id === profile.id) return setError("لا يمكن التحويل لنفسك");

      const { error: rpcErr } = await supabase.rpc("transfer_points", {
        p_to_id: target.id,
        p_points: amount,
        p_transfer_type: transferType,
        p_note: null
      });

      if (rpcErr) return setError(rpcErr.message);

      await refreshProfile();
      const targetName = target.store_name || target.name || target.phone || "المستقبل";
      setMsg(`تم التحويل بنجاح الى ${targetName}`);
      setPoints("");
      setPhone("");
      setPartnerId("");
    } catch (err) {
      setError(err?.message || "حدث خطأ غير متوقع اثناء التحويل");
    }
  };

  return (
    <section className="page">
      <h1>تحويل النقاط</h1>

      <div className="card split">
        <button type="button" className={`btn ${mode === "user" ? "" : "btn-outline"}`} onClick={() => setMode("user")}>
          لمستخدم
        </button>
        <button
          type="button"
          className={`btn ${mode === "partner" ? "" : "btn-outline"}`}
          onClick={() => setMode("partner")}
        >
          لمحل شريك
        </button>
      </div>

      <form className="card" onSubmit={submit}>
        {mode === "user" ? (
          <label>
            رقم تليفون المستخدم
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
        ) : (
          <label>
            اختر المحل الشريك
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
              <option value="">اختر محل...</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.store_name || p.name} - {p.phone}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          عدد النقاط
          <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} required />
        </label>

        {msg ? <p className="success">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <button className="btn" type="submit">
          تأكيد التحويل
        </button>
      </form>
    </section>
  );
}
