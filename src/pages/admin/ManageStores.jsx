import { useEffect, useMemo, useState } from "react";
import { createEphemeralSupabaseClient, phoneToEmail, rpcWithArgFallback, supabase } from "../../lib/supabase";

const roleOptions = [
  { value: "collector_store", label: "محل تجميع" },
  { value: "partner_store", label: "محل شريك" }
];

const initialForm = {
  name: "",
  phone: "",
  storeName: "",
  role: "collector_store",
  password: "",
  photoUrl: ""
};

const normalizePhone = (value) => value.replace(/[^0-9+]/g, "");
const isMissingUpsertFn = (error) =>
  String(error?.message || "").includes("Could not find the function public.admin_upsert_store_profile");

async function loadStoresWithOptionalPhoto() {
  const withPhoto = await supabase
    .from("profiles")
    .select("id,name,phone,role,store_name,photo_url,disabled,created_at")
    .in("role", ["collector_store", "partner_store"])
    .order("created_at", { ascending: false });

  if (!withPhoto.error) return withPhoto;

  const maybeMissingColumn = String(withPhoto.error?.message || "").toLowerCase().includes("photo_url");
  if (!maybeMissingColumn) return withPhoto;

  const fallback = await supabase
    .from("profiles")
    .select("id,name,phone,role,store_name,disabled,created_at")
    .in("role", ["collector_store", "partner_store"])
    .order("created_at", { ascending: false });

  if (!fallback.error) {
    fallback.data = (fallback.data || []).map((item) => ({ ...item, photo_url: "" }));
  }

  return fallback;
}

export default function ManageStores() {
  const [form, setForm] = useState(initialForm);
  const [createAccount, setCreateAccount] = useState(true);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadStores = async () => {
    setLoading(true);
    setError("");

    const response = await loadStoresWithOptionalPhoto();
    setLoading(false);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setStores(response.data || []);
  };

  useEffect(() => {
    loadStores();
  }, []);

  const roleLabel = useMemo(() => {
    return roleOptions.reduce((acc, x) => ({ ...acc, [x.value]: x.label }), {});
  }, []);

  const summary = useMemo(() => {
    const total = stores.length;
    const active = stores.filter((s) => !s.disabled).length;
    const disabled = total - active;
    const collectors = stores.filter((s) => s.role === "collector_store").length;
    const partners = stores.filter((s) => s.role === "partner_store").length;
    return { total, active, disabled, collectors, partners };
  }, [stores]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const phone = normalizePhone(form.phone);
    if (!phone) return setError("رقم الهاتف مطلوب.");
    if (!form.name.trim()) return setError("اسم صاحب المحل مطلوب.");
    if (!form.storeName.trim()) return setError("اسم المحل مطلوب.");

    if (createAccount && String(form.password || "").length < 6) {
      return setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
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

      const cleanPhotoUrl = form.photoUrl.trim();
      const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_role: form.role,
          p_disabled: false,
          p_photo_url: cleanPhotoUrl || null
        },
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_role: form.role,
          p_disabled: false
        },
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_role: form.role
        }
      ]);

      if (rpcErr) {
        if (isMissingUpsertFn(rpcErr)) {
          throw new Error(
            "تعريف دالة حفظ المحل غير موجود/قديم في Supabase. شغّل ملف supabase/admin_tools.sql مرة واحدة ثم حاول مجددًا."
          );
        }
        throw rpcErr;
      }

      setMsg("تم حفظ بيانات المحل بنجاح.");
      setForm(initialForm);
      await loadStores();
    } catch (err) {
      setError(err.message || "تعذر حفظ بيانات المحل.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteStore = async (store) => {
    if (!window.confirm(`هل تريد حذف المحل "${store.store_name || store.name}"؟`)) return;

    setMsg("");
    setError("");
    setDeletingId(store.id);

    try {
      const { error: deleteErr } = await rpcWithArgFallback("admin_delete_store_profile", [
        { p_profile_id: store.id },
        { profile_id: store.id },
        { id: store.id }
      ]);

      if (deleteErr) {
        const isMissingFn = String(deleteErr.message || "").includes("Could not find the function public.admin_delete_store_profile");
        if (!isMissingFn) throw deleteErr;

        // Backward-compatible fallback if SQL migration has not been applied yet.
        const { error: disableErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
          {
            p_phone: store.phone,
            p_name: store.name,
            p_store_name: store.store_name,
            p_role: store.role,
            p_disabled: true,
            p_photo_url: store.photo_url || null
          },
          {
            p_phone: store.phone,
            p_name: store.name,
            p_store_name: store.store_name,
            p_role: store.role,
            p_disabled: true
          },
          {
            p_phone: store.phone,
            p_name: store.name,
            p_store_name: store.store_name,
            p_role: store.role
          }
        ]);

        if (disableErr) {
          if (isMissingUpsertFn(disableErr)) {
            throw new Error(
              "تعريف دالة إدارة المحلات غير موجود في Supabase. شغّل ملف supabase/admin_tools.sql مرة واحدة."
            );
          }
          throw disableErr;
        }
        setMsg("تم تعطيل المحل لأن دالة الحذف غير متاحة حالياً في قاعدة البيانات.");
      } else {
        setMsg("تم حذف المحل بنجاح.");
      }

      await loadStores();
    } catch (err) {
      setError(err.message || "تعذر حذف المحل.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="page">
      <h1>إدارة المحلات</h1>
      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="grid-3">
        <div className="card">
          <h3>إجمالي المحلات</h3>
          <p className="big">{summary.total}</p>
        </div>
        <div className="card">
          <h3>محلات نشطة</h3>
          <p className="big">{summary.active}</p>
        </div>
        <div className="card">
          <h3>محلات معطلة</h3>
          <p className="big">{summary.disabled}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card shops-points-card shops-points-card-collector">
          <h3>محلات التجميع</h3>
          <p className="big">{summary.collectors}</p>
        </div>
        <div className="card shops-points-card shops-points-card-partner">
          <h3>المحلات الشريكة</h3>
          <p className="big">{summary.partners}</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <label>
          اسم صاحب المحل
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </label>

        <label>
          رقم الهاتف
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
        </label>

        <label>
          اسم المحل
          <input value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} required />
        </label>

        <label>
          رابط صورة المحل (اختياري)
          <input
            type="url"
            placeholder="https://example.com/store.jpg"
            value={form.photoUrl}
            onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
          />
        </label>

        {form.photoUrl.trim() ? (
          <div className="shop-photo-preview">
            <img
              src={form.photoUrl}
              alt="معاينة صورة المحل"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/icons/icon-192.svg";
              }}
            />
          </div>
        ) : null}

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
          إنشاء حساب دخول لهذا المحل
        </label>

        {createAccount ? (
          <label>
            كلمة المرور
            <input
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </label>
        ) : (
          <p className="muted">استخدم هذا الخيار إذا كان صاحب المحل لديه حساب موجود بنفس رقم الهاتف.</p>
        )}

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "جاري الحفظ..." : "حفظ المحل"}
        </button>
      </form>

      <div className="card table-wrap">
        <h3>المحلات الحالية</h3>
        {loading ? <p className="muted">جاري التحميل...</p> : null}
        <table>
          <thead>
            <tr>
              <th>الصورة</th>
              <th>المحل</th>
              <th>المالك</th>
              <th>الهاتف</th>
              <th>النوع</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>
                  <img
                    src={s.photo_url || "/icons/icon-192.svg"}
                    alt={s.store_name || s.name || "محل"}
                    className="shop-photo-thumb"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/icons/icon-192.svg";
                    }}
                  />
                </td>
                <td>{s.store_name || "-"}</td>
                <td>{s.name || "-"}</td>
                <td>{s.phone}</td>
                <td>{roleLabel[s.role] || s.role}</td>
                <td>{s.disabled ? "غير مفعل" : "نشط"}</td>
                <td>
                  <button className="btn btn-outline btn-small" onClick={() => deleteStore(s)} disabled={deletingId === s.id}>
                    {deletingId === s.id ? "جاري الحذف..." : "حذف"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stores.length && !loading ? <p className="muted">لا توجد محلات حتى الآن.</p> : null}
      </div>
    </section>
  );
}
