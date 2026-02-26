import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { roles, supabase } from "../../lib/supabase";

async function loadTransferStoresWithOptionalPhoto() {
  const withPhoto = await supabase
    .from("profiles")
    .select("id, name, store_name, phone, role, disabled, photo_url")
    .in("role", [roles.PARTNER, roles.COLLECTOR])
    .eq("disabled", false)
    .order("store_name", { ascending: true });

  if (!withPhoto.error) return withPhoto.data || [];

  const maybeMissingColumn = String(withPhoto.error?.message || "")
    .toLowerCase()
    .includes("photo_url");
  if (!maybeMissingColumn) return [];

  const fallback = await supabase
    .from("profiles")
    .select("id, name, store_name, phone, role, disabled")
    .in("role", [roles.PARTNER, roles.COLLECTOR])
    .eq("disabled", false)
    .order("store_name", { ascending: true });

  return (fallback.data || []).map((p) => ({ ...p, photo_url: "" }));
}

const normalizeArabicDigits = (value) =>
  String(value || "").replace(/[\u0660-\u0669]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)));

const sanitizePhone = (value) => normalizeArabicDigits(value).replace(/[^0-9+]/g, "");

const sanitizePointsInput = (value) => {
  const normalized = normalizeArabicDigits(value).replace(/[\u060C\u066B]/g, ".");
  const allowed = normalized.replace(/[^\d.]/g, "");
  const parts = allowed.split(".");
  if (parts.length === 1) return parts[0];
  const intPart = parts[0] || "0";
  const decimalPart = (parts.slice(1).join("") || "").slice(0, 1);
  return `${intPart}.${decimalPart}`;
};

const toValidAmount = (value) => {
  const clean = sanitizePointsInput(value);
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (!Number.isInteger(n * 10)) return null;
  return n;
};

const formatPoints = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const storeRoleLabel = (role) => {
  if (role === roles.PARTNER) return "محل شريك";
  if (role === roles.COLLECTOR) return "محل تجميع";
  return "محل";
};

export default function Transfer() {
  const { profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState("user");
  const [phone, setPhone] = useState("");
  const [storeId, setStoreId] = useState("");
  const [points, setPoints] = useState("");
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoadingStores(true);
      const list = await loadTransferStoresWithOptionalPhoto();
      setStores(list);
      setLoadingStores(false);
    };
    run();
  }, []);

  const selectedStore = useMemo(() => stores.find((p) => p.id === storeId) || null, [stores, storeId]);
  const selectedTarget = mode === "user" ? targetUser : selectedStore;
  const summary = useMemo(() => {
    const partnerCount = stores.filter((x) => x.role === roles.PARTNER).length;
    const collectorCount = stores.filter((x) => x.role === roles.COLLECTOR).length;
    return { partnerCount, collectorCount, total: stores.length };
  }, [stores]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPhone("");
    setStoreId("");
    setTargetUser(null);
    setPoints("");
    setMsg("");
    setError("");
  };

  const searchUserByPhone = async () => {
    setMsg("");
    setError("");
    setTargetUser(null);

    const normalizedPhone = sanitizePhone(phone);
    if (!normalizedPhone) {
      setError("أدخل رقم الهاتف أولاً.");
      return;
    }

    setSearchingUser(true);
    const { data, error: findErr } = await supabase
      .from("profiles")
      .select("id, role, name, phone")
      .eq("phone", normalizedPhone)
      .eq("role", roles.USER)
      .maybeSingle();
    setSearchingUser(false);

    if (findErr) {
      setError(findErr.message || "تعذر البحث عن المستخدم.");
      return;
    }

    if (!data) {
      setError("لا يوجد مستخدم بهذا الرقم.");
      return;
    }

    if (data.id === profile?.id) {
      setError("لا يمكنك التحويل إلى نفسك.");
      return;
    }

    setTargetUser(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    try {
      const amount = toValidAmount(points);
      if (amount === null) {
        return setError("أدخل عدد نقاط صحيح (مثل: 0.1 أو 1.5).");
      }

      const currentBalance = Number(profile?.points || 0);
      if (amount > currentBalance) {
        return setError("لا يمكنك تحويل نقاط أكثر من رصيدك الحالي.");
      }

      let target = null;
      let transferType = "user_to_user";

      if (mode === "user") {
        if (!targetUser?.id) {
          return setError("ابحث عن المستخدم برقم الهاتف أولاً ثم أكمل التحويل.");
        }
        target = targetUser;
        transferType = "user_to_user";
      } else {
        if (!storeId) return setError("اختر المحل أولاً.");
        target = selectedStore;
        if (!target) return setError("المحل غير متاح حالياً.");
        transferType = "user_to_store";
      }

      const { error: rpcErr } = await supabase.rpc("transfer_points", {
        p_to_id: target.id,
        p_points: amount,
        p_transfer_type: transferType,
        p_note: null
      });

      if (rpcErr) return setError(rpcErr.message);

      await refreshProfile();
      const targetName = target.store_name || target.name || target.phone || "المستلم";
      setMsg(`تم تحويل ${formatPoints(amount)} نقطة بنجاح إلى ${targetName}.`);
      setPoints("");
      setPhone("");
      setTargetUser(null);
      setStoreId("");
    } catch (err) {
      setError(err?.message || "حدث خطأ غير متوقع أثناء التحويل.");
    }
  };

  return (
    <section className="page">
      <h1>تحويل النقاط</h1>

      <div className="card split">
        <button
          type="button"
          className={`btn ${mode === "user" ? "" : "btn-outline"}`}
          onClick={() => switchMode("user")}
        >
          إلى مستخدم
        </button>
        <button
          type="button"
          className={`btn ${mode === "store" ? "" : "btn-outline"}`}
          onClick={() => switchMode("store")}
        >
          إلى محل
        </button>
      </div>

      <div className="card">
        <h3>رؤية سريعة</h3>
        <p className="muted">رصيدك الحالي: {formatPoints(profile?.points)} نقطة</p>
        <p className="muted">
          المحلات المتاحة: {summary.total} (شريك: {summary.partnerCount} | تجميع: {summary.collectorCount})
        </p>
      </div>

      <form className="card" onSubmit={submit} noValidate>
        {mode === "user" ? (
          <>
            <div className="split">
              <label style={{ flex: 1 }}>
                رقم هاتف المستخدم المستلم
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(sanitizePhone(e.target.value));
                    setTargetUser(null);
                    setMsg("");
                    setError("");
                  }}
                  required
                />
              </label>
              <button type="button" className="btn" onClick={searchUserByPhone} disabled={searchingUser}>
                {searchingUser ? "جاري البحث..." : "بحث"}
              </button>
            </div>

            {targetUser ? (
              <div className="card" style={{ marginTop: 8 }}>
                <p>
                  <strong>تم العثور على المستخدم:</strong> {targetUser.name || "-"}
                </p>
                <p className="muted">الهاتف: {targetUser.phone || "-"}</p>
              </div>
            ) : null}
          </>
        ) : (
          <label>
            اختر المحل (شريك أو تجميع)
            <select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                setMsg("");
                setError("");
              }}
              required
            >
              <option value="">اختر محلاً...</option>
              {stores.map((p) => (
                <option key={p.id} value={p.id}>
                  [{storeRoleLabel(p.role)}] {p.store_name || p.name} - {p.phone}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedTarget ? (
          <div className="card" style={{ marginTop: 8, marginBottom: 8 }}>
            <p>
              <strong>المستلم المختار:</strong>{" "}
              {selectedTarget.store_name || selectedTarget.name || "-"}
            </p>
            <p className="muted">الهاتف: {selectedTarget.phone || "-"}</p>
            {selectedTarget.role ? <p className="muted">النوع: {storeRoleLabel(selectedTarget.role)}</p> : null}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 8, marginBottom: 8 }}>
            اختر المستلم أولاً قبل تأكيد التحويل.
          </p>
        )}

        <label>
          عدد النقاط
          <input
            type="text"
            inputMode="decimal"
            placeholder="مثال: 0.1 أو 1.5"
            value={points}
            onChange={(e) => {
              setPoints(sanitizePointsInput(e.target.value));
              setMsg("");
              setError("");
            }}
            required
          />
        </label>

        {msg ? <p className="success">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <button className="btn" type="submit" disabled={!selectedTarget || searchingUser}>
          {!selectedTarget ? "اختر المستلم أولاً" : "تأكيد التحويل"}
        </button>
      </form>

      {mode === "store" ? (
        <div className="card">
          <h3>المحلات المتاحة</h3>
          {loadingStores ? <p className="muted">جاري تحميل قائمة المحلات...</p> : null}
          <div className="shops-grid">
            {stores.map((shop) => (
              <article className="shop-item" key={shop.id}>
                <img
                  src={shop.photo_url || "/icons/icon-192.svg"}
                  alt={shop.store_name || shop.name || "محل"}
                  className="shop-photo"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/icons/icon-192.svg";
                  }}
                />
                <div>
                  <h4>{shop.store_name || shop.name || "-"}</h4>
                  <p className="muted">{shop.phone || "-"}</p>
                  <p className="muted">{storeRoleLabel(shop.role)}</p>
                </div>
              </article>
            ))}
          </div>
          {!stores.length && !loadingStores ? <p className="muted">لا توجد محلات متاحة حالياً.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
