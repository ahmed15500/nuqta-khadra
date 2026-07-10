import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { roles, supabase } from "../../lib/supabase";

const FALLBACK_CATEGORY = "other_services";

const LEGACY_CATEGORY_LABELS = {
  grocery: "بقالة",
  fruits_vegetables: "خضار / فاكهة",
  stationery: "أدوات مكتبية",
  pharmacy: "صيدلية",
  clothing: "ملابس",
  other_services: "خدمات أخرى"
};

const normalizeCategory = (value) => String(value || "").trim() || FALLBACK_CATEGORY;
const categoryLabel = (value) => LEGACY_CATEGORY_LABELS[value] || value || "خدمات أخرى";

async function loadTransferStoresWithOptionalPhoto() {
  const withPhoto = await supabase
    .from("profiles")
    .select("id, name, store_name, store_category, phone, role, disabled, photo_url")
    .in("role", [roles.PARTNER, roles.COLLECTOR])
    .eq("disabled", false)
    .order("store_name", { ascending: true });

  if (!withPhoto.error) {
    return (withPhoto.data || []).map((p) => ({
      ...p,
      store_category: normalizeCategory(p.store_category)
    }));
  }

  const maybeMissingColumn = String(withPhoto.error?.message || "").toLowerCase().match(/photo_url|store_category/);
  if (!maybeMissingColumn) return [];

  const fallback = await supabase
    .from("profiles")
    .select("id, name, store_name, phone, role, disabled")
    .in("role", [roles.PARTNER, roles.COLLECTOR])
    .eq("disabled", false)
    .order("store_name", { ascending: true });

  return (fallback.data || []).map((p) => ({
    ...p,
    photo_url: "",
    store_category: FALLBACK_CATEGORY
  }));
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
  if (!Number.isFinite(n) || n <= 0) return null;
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
  const [selectedCategory, setSelectedCategory] = useState("all");
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

  const categories = useMemo(() => {
    const set = new Set(stores.map((s) => normalizeCategory(s.store_category)));
    return Array.from(set).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "ar"));
  }, [stores]);

  const filteredStores = useMemo(() => {
    if (selectedCategory === "all") return stores;
    return stores.filter((s) => normalizeCategory(s.store_category) === selectedCategory);
  }, [stores, selectedCategory]);

  const selectedStore = useMemo(() => stores.find((p) => p.id === storeId) || null, [stores, storeId]);
  const selectedTarget = mode === "user" ? targetUser : selectedStore;

  const summary = useMemo(() => {
    const partnerCount = stores.filter((x) => x.role === roles.PARTNER).length;
    const collectorCount = stores.filter((x) => x.role === roles.COLLECTOR).length;
    return { partnerCount, collectorCount, total: stores.length };
  }, [stores]);

  useEffect(() => {
    if (!storeId) return;
    const exists = filteredStores.some((s) => s.id === storeId);
    if (!exists) setStoreId("");
  }, [filteredStores, storeId]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPhone("");
    setStoreId("");
    setSelectedCategory("all");
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
    if (!normalizedPhone) return setError("أدخل رقم الهاتف أولًا.");

    setSearchingUser(true);
    const { data, error: findErr } = await supabase
      .from("profiles")
      .select("id, role, name, phone")
      .eq("phone", normalizedPhone)
      .eq("role", roles.USER)
      .maybeSingle();
    setSearchingUser(false);

    if (findErr) return setError(findErr.message || "تعذر البحث عن المستخدم.");
    if (!data) return setError("لا يوجد مستخدم بهذا الرقم.");
    if (data.id === profile?.id) return setError("لا يمكنك التحويل إلى نفسك.");

    setTargetUser(data);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    try {
      const amount = toValidAmount(points);
      if (amount === null) return setError("أدخل عدد نقاط صحيح (مثل: 0.1 أو 1.5).");

      const currentBalance = Number(profile?.points || 0);
      if (amount > currentBalance) return setError("لا يمكنك تحويل نقاط أكثر من رصيدك الحالي.");

      let target = null;
      let transferType = "user_to_user";

      if (mode === "user") {
        if (!targetUser?.id) return setError("ابحث عن المستخدم برقم الهاتف أولًا ثم أكمل التحويل.");
        target = targetUser;
      } else {
        if (!storeId) return setError("اختر المحل أولًا.");
        target = selectedStore;
        if (!target) return setError("المحل غير متاح حاليًا.");
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
        <button type="button" className={`btn ${mode === "user" ? "" : "btn-outline"}`} onClick={() => switchMode("user")}>
          إلى مستخدم
        </button>
        <button type="button" className={`btn ${mode === "store" ? "" : "btn-outline"}`} onClick={() => switchMode("store")}>
          إلى محل
        </button>
      </div>

      <div className="card">
        <h3>رؤية سريعة</h3>
        <p className="muted">رصيدك الحالي: {formatPoints(profile?.points)} نقطة</p>
        <p className="muted">المحلات المتاحة: {summary.total} (شريك: {summary.partnerCount} | تجميع: {summary.collectorCount})</p>
      </div>

      <form className="card transfer-form" onSubmit={submit} noValidate>
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
                <p><strong>تم العثور على المستخدم:</strong> {targetUser.name || "-"}</p>
                <p className="muted">الهاتف: {targetUser.phone || "-"}</p>
              </div>
            ) : null}
          </>
        ) : (
          <label>
            اختر المحل (شريك أو تجميع)
            <select
              className="transfer-shop-select"
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                setMsg("");
                setError("");
              }}
              required
            >
              <option value="">اختر محلاً...</option>
              {filteredStores.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.store_name || p.name || "-")} - {storeRoleLabel(p.role)}
                </option>
              ))}
            </select>
          </label>
        )}

        {selectedTarget ? (
          <div className="card transfer-target-card" style={{ marginTop: 8, marginBottom: 8 }}>
            <p><strong>المستلم المختار:</strong> {selectedTarget.store_name || selectedTarget.name || "-"}</p>
            <p className="muted">الهاتف: {selectedTarget.phone || "-"}</p>
            {selectedTarget.role ? <p className="muted">النوع: {storeRoleLabel(selectedTarget.role)}</p> : null}
            {selectedTarget.store_category ? <p className="muted">التصنيف: {categoryLabel(selectedTarget.store_category)}</p> : null}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 8, marginBottom: 8 }}>
            اختر المستلم أولًا قبل تأكيد التحويل.
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
          {!selectedTarget ? "اختر المستلم أولًا" : "تأكيد التحويل"}
        </button>
      </form>

      {mode === "store" ? (
        <div className="card">
          <h3>المحلات المتاحة</h3>
          {loadingStores ? <p className="muted">جاري تحميل قائمة المحلات...</p> : null}

          <div className="transfer-categories">
            <button
              type="button"
              className={`btn btn-small ${selectedCategory === "all" ? "" : "btn-outline"}`}
              onClick={() => setSelectedCategory("all")}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`btn btn-small ${selectedCategory === cat ? "" : "btn-outline"}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="shops-grid">
            {filteredStores.map((shop) => (
              <article
                className={`shop-item shop-item-selectable ${storeId === shop.id ? "shop-item-selected" : ""}`}
                key={shop.id}
                onClick={() => {
                  setStoreId(shop.id);
                  setMsg("");
                  setError("");
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setStoreId(shop.id);
                    setMsg("");
                    setError("");
                  }
                }}
              >
                <img
                  src={shop.photo_url || "/icons/icon-192.png"}
                  alt={shop.store_name || shop.name || "محل"}
                  className="shop-photo"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/icons/icon-192.png";
                  }}
                />
                <div className="shop-item-copy">
                  <h4 className="shop-name">{shop.store_name || shop.name || "-"}</h4>
                  <p className="muted shop-meta">{shop.phone || "-"}</p>
                  <p className="muted">{storeRoleLabel(shop.role)}</p>
                  <p className="muted">{categoryLabel(shop.store_category)}</p>
                </div>
              </article>
            ))}
          </div>
          {!filteredStores.length && !loadingStores ? <p className="muted">لا توجد محلات في هذا التصنيف حاليًا.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
