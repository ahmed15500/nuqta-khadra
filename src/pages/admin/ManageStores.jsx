import { useEffect, useMemo, useState } from "react";
import { createEphemeralSupabaseClient, phoneToEmail, rpcWithArgFallback, supabase } from "../../lib/supabase";

const roleOptions = [
  { value: "collector_store", label: "محل جمع" },
  { value: "partner_store", label: "محل شريك" }
];

const initialForm = {
  name: "",
  phone: "",
  storeName: "",
  role: "collector_store",
  password: ""
};

const normalizePhone = (value) => value.replace(/[^0-9+]/g, "");

export default function ManageStores() {
  const [form, setForm] = useState(initialForm);
  const [createAccount, setCreateAccount] = useState(true);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadStores = async () => {
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("id,name,phone,role,store_name,disabled,created_at")
      .in("role", ["collector_store", "partner_store"])
      .order("created_at", { ascending: false });
    setLoading(false);

    if (qErr) {
      setError(qErr.message);
      return;
    }

    setStores(data || []);
  };

  useEffect(() => {
    loadStores();
  }, []);

  const roleLabel = useMemo(() => {
    return roleOptions.reduce((acc, x) => ({ ...acc, [x.value]: x.label }), {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const phone = normalizePhone(form.phone);
    if (!phone) return setError("رقم الهاتف مطلوب");
    if (!form.name.trim()) return setError("اسم صاحب الحساب مطلوب");
    if (!form.storeName.trim()) return setError("اسم المحل مطلوب");

    if (createAccount && String(form.password || "").length < 6) {
      return setError("كلمة السر يجب ان تكون 6 حروف على الاقل");
    }

    setSubmitting(true);

    try {
      if (createAccount) {
        const oneShotClient = createEphemeralSupabaseClient();
        const { error: signErr } = await oneShotClient.auth.signUp({
          email: phoneToEmail(phone),
          password: form.password,
          options: {
            data: {
              name: form.name.trim(),
              phone
            }
          }
        });

        if (signErr && !/already/i.test(signErr.message || "")) {
          throw signErr;
        }
      }

      const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_role: form.role,
          p_disabled: false
        },
        {
          phone,
          name: form.name.trim(),
          store_name: form.storeName.trim(),
          role: form.role,
          disabled: false
        }
      ]);

      if (rpcErr) throw rpcErr;

      setMsg("تم حفظ حساب المحل بنجاح");
      setForm(initialForm);
      await loadStores();
    } catch (err) {
      setError(err.message || "فشل حفظ بيانات المحل");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <h1>ادارة المحلات</h1>
      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <form className="card" onSubmit={submit}>
        <label>
          اسم صاحب الحساب
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </label>
        <label>
          رقم الهاتف
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
        </label>
        <label>
          اسم المحل
          <input
            value={form.storeName}
            onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))}
            required
          />
        </label>
        <label>
          نوع المحل
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {roleOptions.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-check">
          <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
          انشاء حساب تسجيل دخول جديد للمحل
        </label>

        {createAccount ? (
          <label>
            كلمة السر
            <input
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </label>
        ) : (
          <p className="muted">استخدم هذا الخيار فقط لو صاحب المحل مسجل بالفعل بحساب مستخدم بنفس رقم الهاتف.</p>
        )}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "جارى الحفظ..." : "حفظ المحل"}
        </button>
      </form>

      <div className="card table-wrap">
        <h3>المحلات الحالية</h3>
        {loading ? <p className="muted">جارى التحميل...</p> : null}
        <table>
          <thead>
            <tr>
              <th>اسم المحل</th>
              <th>المالك</th>
              <th>الهاتف</th>
              <th>الدور</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>{s.store_name || "-"}</td>
                <td>{s.name || "-"}</td>
                <td>{s.phone}</td>
                <td>{roleLabel[s.role] || s.role}</td>
                <td>{s.disabled ? "موقوف" : "نشط"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stores.length && !loading ? <p className="muted">لا توجد محلات بعد</p> : null}
      </div>
    </section>
  );
}
