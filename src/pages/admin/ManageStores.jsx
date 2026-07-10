import { useEffect, useMemo, useState } from "react";
import { createEphemeralSupabaseClient, phoneToEmail, rpcWithArgFallback, supabase } from "../../lib/supabase";

const roleOptions = [
  { value: "collector_store", label: "محل تجميع" },
  { value: "partner_store", label: "محل شريك" }
];

const defaultCategories = ["بقالة", "خضار / فاكهة", "أدوات مكتبية", "صيدلية", "ملابس", "خدمات أخرى"];
const ADD_CATEGORY_OPTION = "__add_new_category__";

const initialForm = {
  name: "",
  phone: "",
  storeName: "",
  storeCategory: "خدمات أخرى",
  role: "collector_store",
  password: "",
  photoUrl: ""
};

const normalizePhone = (value) => value.replace(/[^0-9+]/g, "");
const normalizeCategory = (value) => String(value || "").trim();
const isMissingUpsertFn = (error) =>
  String(error?.message || "").includes("Could not find the function public.admin_upsert_store_profile");

async function loadStoresWithOptionalPhoto() {
  const withPhoto = await supabase
    .from("profiles")
    .select("id,name,phone,role,store_name,store_category,photo_url,disabled,created_at")
    .in("role", ["collector_store", "partner_store"])
    .order("created_at", { ascending: false });

  if (!withPhoto.error) {
    withPhoto.data = (withPhoto.data || []).map((item) => ({
      ...item,
      store_category: normalizeCategory(item.store_category) || "خدمات أخرى"
    }));
    return withPhoto;
  }

  const maybeMissingColumn = String(withPhoto.error?.message || "").toLowerCase().match(/photo_url|store_category/);
  if (!maybeMissingColumn) return withPhoto;

  const fallback = await supabase
    .from("profiles")
    .select("id,name,phone,role,store_name,disabled,created_at")
    .in("role", ["collector_store", "partner_store"])
    .order("created_at", { ascending: false });

  if (!fallback.error) {
    fallback.data = (fallback.data || []).map((item) => ({
      ...item,
      photo_url: "",
      store_category: "خدمات أخرى"
    }));
  }

  return fallback;
}

export default function ManageStores() {
  const [form, setForm] = useState(initialForm);
  const [newCategory, setNewCategory] = useState("");
  const [createAccount, setCreateAccount] = useState(true);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingCategoryId, setUpdatingCategoryId] = useState("");
  const [updatingRoleId, setUpdatingRoleId] = useState("");
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

  const roleLabel = useMemo(() => roleOptions.reduce((acc, x) => ({ ...acc, [x.value]: x.label }), {}), []);

  const categories = useMemo(() => {
    const values = new Set(defaultCategories);
    stores.forEach((s) => values.add(normalizeCategory(s.store_category) || "خدمات أخرى"));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "ar"));
  }, [stores]);

  const summary = useMemo(() => {
    const total = stores.length;
    const active = stores.filter((s) => !s.disabled).length;
    const disabled = total - active;
    const collectors = stores.filter((s) => s.role === "collector_store").length;
    const partners = stores.filter((s) => s.role === "partner_store").length;
    return { total, active, disabled, collectors, partners };
  }, [stores]);

  const addCategory = () => {
    const clean = normalizeCategory(newCategory);
    if (!clean) return;
    setForm((p) => ({ ...p, storeCategory: clean }));
    setNewCategory("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const phone = normalizePhone(form.phone);
    const storeCategory = normalizeCategory(form.storeCategory) || "خدمات أخرى";
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
          options: { data: { name: form.name.trim(), phone } }
        });
        if (signErr && !/already/i.test(signErr.message || "")) throw signErr;
      }

      const cleanPhotoUrl = form.photoUrl.trim();
      const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_store_category: storeCategory,
          p_role: form.role,
          p_disabled: false,
          p_photo_url: cleanPhotoUrl || null
        },
        {
          p_phone: phone,
          p_name: form.name.trim(),
          p_store_name: form.storeName.trim(),
          p_store_category: storeCategory,
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
          throw new Error("تعريف دالة حفظ المحل غير موجود/قديم في Supabase. شغّل ملف supabase/admin_tools.sql مرة واحدة ثم حاول مجددًا.");
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

        const { error: disableErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
          {
            p_phone: store.phone,
            p_name: store.name,
            p_store_name: store.store_name,
            p_store_category: normalizeCategory(store.store_category) || "خدمات أخرى",
            p_role: store.role,
            p_disabled: true,
            p_photo_url: store.photo_url || null
          },
          {
            p_phone: store.phone,
            p_name: store.name,
            p_store_name: store.store_name,
            p_store_category: normalizeCategory(store.store_category) || "خدمات أخرى",
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
            throw new Error("تعريف دالة إدارة المحلات غير موجود في Supabase. شغّل ملف supabase/admin_tools.sql مرة واحدة.");
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

  const updateStoreCategory = async (store, nextCategoryRaw) => {
    const nextCategory = normalizeCategory(nextCategoryRaw);
    if (!nextCategory || nextCategory === normalizeCategory(store.store_category)) return;

    setMsg("");
    setError("");
    setUpdatingCategoryId(store.id);

    try {
      const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_store_category: nextCategory,
          p_role: store.role,
          p_disabled: Boolean(store.disabled),
          p_photo_url: store.photo_url || null
        },
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_store_category: nextCategory,
          p_role: store.role,
          p_disabled: Boolean(store.disabled)
        },
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_role: store.role
        }
      ]);

      if (rpcErr) {
        if (isMissingUpsertFn(rpcErr)) {
          await updateStoreCategoryDirect(store.id, nextCategory);
        } else {
          throw rpcErr;
        }
      }

      setStores((prev) => prev.map((row) => (row.id === store.id ? { ...row, store_category: nextCategory } : row)));
      setMsg("تم تحديث تصنيف المحل.");
    } catch (err) {
      setError(err?.message || "تعذر تحديث تصنيف المحل.");
    } finally {
      setUpdatingCategoryId("");
    }
  };

  const onCategoryChange = async (store, selectedValue) => {
    if (selectedValue === ADD_CATEGORY_OPTION) {
      const custom = window.prompt("اكتب التصنيف الجديد");
      const clean = normalizeCategory(custom);
      if (!clean) return;
      await updateStoreCategory(store, clean);
      return;
    }

    await updateStoreCategory(store, selectedValue);
  };

  const updateStoreCategoryDirect = async (storeId, nextCategory) => {
    const { error: updateErr } = await supabase.from("profiles").update({ store_category: nextCategory }).eq("id", storeId);
    if (updateErr) throw updateErr;
  };

  const updateStoreRoleDirect = async (storeId, nextRole) => {
    const { error: updateErr } = await supabase.from("profiles").update({ role: nextRole }).eq("id", storeId);
    if (updateErr) throw updateErr;
  };

  const updateStoreRole = async (store, nextRole) => {
    if (!nextRole || nextRole === store.role) return;
    setMsg("");
    setError("");
    setUpdatingRoleId(store.id);

    try {
      const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_store_category: normalizeCategory(store.store_category) || "خدمات أخرى",
          p_role: nextRole,
          p_disabled: Boolean(store.disabled),
          p_photo_url: store.photo_url || null
        },
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_store_category: normalizeCategory(store.store_category) || "خدمات أخرى",
          p_role: nextRole,
          p_disabled: Boolean(store.disabled)
        },
        {
          p_phone: store.phone,
          p_name: store.name || store.store_name || "Store",
          p_store_name: store.store_name,
          p_role: nextRole
        }
      ]);

      if (rpcErr) {
        if (isMissingUpsertFn(rpcErr)) {
          await updateStoreRoleDirect(store.id, nextRole);
        } else {
          throw rpcErr;
        }
      }

      setStores((prev) => prev.map((row) => (row.id === store.id ? { ...row, role: nextRole } : row)));
      setMsg("تم تحديث نوع المحل.");
    } catch (err) {
      setError(err?.message || "تعذر تحديث نوع المحل.");
    } finally {
      setUpdatingRoleId("");
    }
  };

  return (
    <section className="page">
      <h1>إدارة المحلات</h1>
      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="grid-3">
        <div className="card"><h3>إجمالي المحلات</h3><p className="big">{summary.total}</p></div>
        <div className="card"><h3>محلات نشطة</h3><p className="big">{summary.active}</p></div>
        <div className="card"><h3>محلات معطلة</h3><p className="big">{summary.disabled}</p></div>
      </div>

      <div className="grid-2">
        <div className="card shops-points-card shops-points-card-collector"><h3>محلات التجميع</h3><p className="big">{summary.collectors}</p></div>
        <div className="card shops-points-card shops-points-card-partner"><h3>المحلات الشريكة</h3><p className="big">{summary.partners}</p></div>
      </div>

      <form className="card" onSubmit={submit}>
        <label>اسم صاحب المحل<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></label>
        <label>رقم الهاتف<input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required /></label>
        <label>اسم المحل<input value={form.storeName} onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))} required /></label>

        <label>
          تصنيف المحل
          <input
            list="store-categories"
            value={form.storeCategory}
            onChange={(e) => setForm((p) => ({ ...p, storeCategory: e.target.value }))}
            placeholder="مثال: أدوات مكتبية"
            required
          />
          <datalist id="store-categories">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </label>

        <div className="split">
          <label style={{ flex: 1 }}>
            إضافة تصنيف جديد
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="اكتب تصنيف جديد ثم اضغط إضافة"
            />
          </label>
          <button type="button" className="btn btn-outline" onClick={addCategory}>إضافة</button>
        </div>

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
                e.currentTarget.src = "/icons/icon-192.png";
              }}
            />
          </div>
        ) : null}

        <label>
          نوع المحل
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {roleOptions.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
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
            <input type="password" minLength={6} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
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
              <th>التصنيف</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>
                  <img
                    src={s.photo_url || "/icons/icon-192.png"}
                    alt={s.store_name || s.name || "محل"}
                    className="shop-photo-thumb"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/icons/icon-192.png";
                    }}
                  />
                </td>
                <td>{s.store_name || "-"}</td>
                <td>{s.name || "-"}</td>
                <td>{s.phone}</td>
                <td>
                  <select
                    value={s.role}
                    disabled={updatingRoleId === s.id}
                    onChange={(e) => updateStoreRole(s, e.target.value)}
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={normalizeCategory(s.store_category) || "خدمات أخرى"}
                    disabled={updatingCategoryId === s.id}
                    onChange={(e) => onCategoryChange(s, e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value={ADD_CATEGORY_OPTION}>+ إضافة تصنيف جديد</option>
                  </select>
                </td>
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
