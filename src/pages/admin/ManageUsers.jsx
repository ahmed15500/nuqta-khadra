import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  createEphemeralSupabaseClient,
  phoneToEmail,
  roles,
  rpcWithArgFallback,
  supabase
} from "../../lib/supabase";

const roleOptions = [
  { value: roles.USER, label: "مستخدم" },
  { value: roles.COLLECTOR, label: "محل تجميع" },
  { value: roles.PARTNER, label: "محل شريك" }
];

const roleLabels = {
  [roles.USER]: "مستخدم",
  [roles.COLLECTOR]: "محل تجميع",
  [roles.PARTNER]: "محل شريك",
  [roles.ADMIN]: "أدمن"
};

const ALREADY_REGISTERED_MSG =
  "الرقم ده مسجل قبل كده — لو نسي الباسورد الأدمن ميقدرش يغيّره من هنا.";

const initialForm = {
  name: "",
  phone: "",
  role: roles.USER,
  storeName: "",
  password: ""
};

const normalizePhone = (value) => String(value || "").replace(/[^0-9+]/g, "");

const isMissingUpsertFn = (error) =>
  String(error?.message || "").includes("Could not find the function public.admin_upsert_store_profile");

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 4294967295);
  }
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export default function ManageUsers() {
  const { profile: adminProfile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const isStoreRole = form.role === roles.COLLECTOR || form.role === roles.PARTNER;

  const load = async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id,name,phone,role,points,store_name,disabled,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (loadError) {
      setError(loadError.message || "تعذر تحميل قائمة المستخدمين.");
      setUsers([]);
      return;
    }

    setUsers(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(
    () => ({
      total: users.length,
      regular: users.filter((u) => u.role === roles.USER).length,
      stores: users.filter((u) => u.role === roles.COLLECTOR || u.role === roles.PARTNER).length,
      disabled: users.filter((u) => u.disabled).length
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      const name = String(u.name || "").toLowerCase();
      const storeName = String(u.store_name || "").toLowerCase();
      const phone = String(u.phone || "").replace(/[^0-9]/g, "");
      return name.includes(q) || storeName.includes(q) || (qDigits && phone.includes(qDigits));
    });
  }, [users, search, roleFilter]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const name = form.name.trim();
    const phone = normalizePhone(form.phone);
    const password = String(form.password || "");

    if (!name) return setError("اسم المستخدم مطلوب.");
    if (!phone) return setError("رقم الموبايل مطلوب.");
    if (password.length < 6) return setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
    if (isStoreRole && !form.storeName.trim()) return setError("اسم المحل مطلوب لحسابات المحلات.");

    setSubmitting(true);

    try {
      const oneShotClient = createEphemeralSupabaseClient();
      const { data, error: signErr } = await oneShotClient.auth.signUp({
        email: phoneToEmail(phone),
        password,
        options: { data: { name, phone } }
      });

      if (signErr) {
        if (/already/i.test(signErr.message || "")) {
          setError(ALREADY_REGISTERED_MSG);
          return;
        }
        throw signErr;
      }

      // Supabase may hide "already registered" behind a user with no identities.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError(ALREADY_REGISTERED_MSG);
        return;
      }

      if (form.role === roles.USER) {
        const userId = data?.user?.id;
        if (!userId) {
          setError(ALREADY_REGISTERED_MSG);
          return;
        }

        const { error: upsertError } = await oneShotClient.from("profiles").upsert({
          id: userId,
          name,
          phone,
          role: roles.USER,
          store_name: null,
          points: 0,
          disabled: false
        });

        if (upsertError) throw upsertError;
      } else {
        const { error: rpcErr } = await rpcWithArgFallback("admin_upsert_store_profile", [
          {
            p_phone: phone,
            p_name: name,
            p_store_name: form.storeName.trim(),
            p_store_category: "خدمات أخرى",
            p_role: form.role,
            p_disabled: false,
            p_photo_url: null
          },
          {
            p_phone: phone,
            p_name: name,
            p_store_name: form.storeName.trim(),
            p_store_category: "خدمات أخرى",
            p_role: form.role,
            p_disabled: false
          },
          {
            p_phone: phone,
            p_name: name,
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
      }

      setMsg(`تم إنشاء حساب ${name} بنجاح — يقدر يدخل برقم الموبايل والباسورد اللي كتبتها.`);
      setForm(initialForm);
      setShowPassword(false);
      await load();
    } catch (err) {
      setError(err.message || "تعذر إنشاء الحساب.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDisabled = async (user) => {
    setMsg("");
    setError("");

    if (adminProfile?.id && user.id === adminProfile.id) {
      setError("مش هينفع تعطّل حسابك وانت داخل بيه.");
      return;
    }

    setTogglingId(user.id);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ disabled: !user.disabled })
      .eq("id", user.id);

    setTogglingId("");

    if (updateError) {
      setError(updateError.message || "تعذر تحديث حالة الحساب.");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, disabled: !u.disabled } : u)));
    setMsg(user.disabled ? `تم تفعيل حساب ${user.name || ""}.` : `تم تعطيل حساب ${user.name || ""}.`);
  };

  return (
    <section className="page">
      <h1>إدارة المستخدمين</h1>
      <p className="muted">
        أنشئ حسابات دخول للمستخدمين والمحلات واكتب لكل واحد الباسورد بتاعته. الباسوردات القديمة مش بتظهر هنا أبدًا لأنها
        مشفرة.
      </p>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="grid-3">
        <div className="card">
          <h3>إجمالي الحسابات</h3>
          <p className="big">{summary.total.toLocaleString("ar-EG")}</p>
        </div>
        <div className="card">
          <h3>مستخدمين / محلات</h3>
          <p className="big">
            {summary.regular.toLocaleString("ar-EG")} / {summary.stores.toLocaleString("ar-EG")}
          </p>
        </div>
        <div className="card">
          <h3>حسابات معطلة</h3>
          <p className="big">{summary.disabled.toLocaleString("ar-EG")}</p>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <h3>إضافة مستخدم جديد</h3>

        <label>
          الاسم
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </label>

        <label>
          رقم الموبايل
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />
        </label>

        <label>
          الدور
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {isStoreRole ? (
          <label>
            اسم المحل
            <input
              value={form.storeName}
              onChange={(e) => setForm((p) => ({ ...p, storeName: e.target.value }))}
              required
            />
          </label>
        ) : null}

        <label>
          كلمة المرور
          <span style={{ position: "relative", display: "block" }}>
            <input
              type={showPassword ? "text" : "password"}
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              style={{ paddingInlineEnd: 46 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              style={{
                position: "absolute",
                insetInlineEnd: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                border: 0,
                borderRadius: 10,
                background: "transparent",
                color: "var(--muted)",
                cursor: "pointer"
              }}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>

        <div className="split">
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => setForm((p) => ({ ...p, password: generatePassword(10) }))}
          >
            <RefreshCw size={15} /> توليد باسورد عشوائية
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            اكتب الباسورد وادّيها لصاحب الحساب — مش هتظهر تاني بعد الإنشاء.
          </span>
        </div>

        <button className="btn" type="submit" disabled={submitting} style={{ marginTop: 12 }}>
          {submitting ? "جاري الإنشاء..." : "إنشاء الحساب"}
        </button>
      </form>

      <div className="card">
        <h3>بحث وتصفية</h3>
        <div className="grid-2">
          <label>
            بحث بالاسم أو رقم الموبايل
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اكتب الاسم أو الرقم" />
          </label>
          <label>
            الدور
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">كل الأدوار</option>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value={roles.ADMIN}>أدمن</option>
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          عرض {filtered.length.toLocaleString("ar-EG")} من {users.length.toLocaleString("ar-EG")} حساب.
        </p>
      </div>

      {loading ? <p className="muted">جاري التحميل...</p> : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الموبايل</th>
              <th>الدور</th>
              <th>النقاط</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.name || "-"}
                  {user.store_name ? <span className="muted"> ({user.store_name})</span> : null}
                </td>
                <td>{user.phone || "-"}</td>
                <td>{roleLabels[user.role] || user.role || "-"}</td>
                <td>{Number(user.points || 0).toLocaleString("ar-EG")}</td>
                <td>{user.disabled ? "معطّل" : "مفعل"}</td>
                <td className="actions-cell">
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => toggleDisabled(user)}
                    disabled={togglingId === user.id}
                  >
                    {togglingId === user.id ? "جاري..." : user.disabled ? "تفعيل" : "تعطيل"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && !loading ? (
          <p className="muted">
            {users.length ? "لا توجد نتائج مطابقة للبحث أو التصفية الحالية." : "لا توجد حسابات للعرض حاليًا."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
