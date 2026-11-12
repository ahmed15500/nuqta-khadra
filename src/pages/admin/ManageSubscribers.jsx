import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر"
];

const nowDate = new Date();
const CURRENT_YEAR = nowDate.getFullYear();
const CURRENT_MONTH = nowDate.getMonth() + 1;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const initialForm = {
  fullName: "",
  phone: "",
  village: "",
  address: "",
  notes: ""
};

const initialPayForm = {
  year: String(CURRENT_YEAR),
  month: String(CURRENT_MONTH),
  paidOn: todayIso()
};

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ar-EG");
}

function monthLabel(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) return "-";
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default function ManageSubscribers() {
  const [customers, setCustomers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [villageFilter, setVillageFilter] = useState("");

  const [form, setForm] = useState(initialForm);
  const [adding, setAdding] = useState(false);

  const [payForId, setPayForId] = useState("");
  const [payForm, setPayForm] = useState(initialPayForm);
  const [payingId, setPayingId] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [historyForId, setHistoryForId] = useState("");
  const [editingSubId, setEditingSubId] = useState("");
  const [subEditForm, setSubEditForm] = useState(initialPayForm);
  const [savingSubId, setSavingSubId] = useState("");
  const [deletingSubId, setDeletingSubId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    const [{ data: customerRows, error: customersError }, { data: subRows, error: subsError }] =
      await Promise.all([
        supabase
          .from("eco_waste_customers")
          .select("id,full_name,phone,village,address,notes,created_at")
          .order("full_name"),
        supabase
          .from("eco_waste_subscriptions")
          .select("id,customer_id,subscription_year,subscription_month,paid_on,created_at")
          .order("subscription_year", { ascending: false })
          .order("subscription_month", { ascending: false })
          .order("created_at", { ascending: false })
      ]);

    setLoading(false);

    if (customersError) {
      setError(customersError.message || "تعذر تحميل قائمة المشتركين.");
      setCustomers([]);
      setSubscriptions([]);
      return;
    }

    if (subsError) {
      setError(subsError.message || "تعذر تحميل بيانات الاشتراكات.");
    }

    setCustomers(customerRows || []);
    setSubscriptions(subsError ? [] : subRows || []);
  };

  useEffect(() => {
    load();
  }, []);

  const villages = useMemo(() => {
    const set = new Set();
    customers.forEach((c) => {
      const v = String(c.village || "").trim();
      if (v) set.add(v);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "ar"));
  }, [customers]);

  const subsByCustomer = useMemo(() => {
    const map = new Map();
    subscriptions.forEach((s) => {
      if (!s.customer_id) return;
      if (!map.has(s.customer_id)) map.set(s.customer_id, []);
      map.get(s.customer_id).push(s);
    });
    return map;
  }, [subscriptions]);

  const latestSubByCustomer = useMemo(() => {
    const map = new Map();
    subsByCustomer.forEach((list, customerId) => {
      const sorted = [...list].sort((a, b) => {
        const ya = Number(a.subscription_year || 0);
        const yb = Number(b.subscription_year || 0);
        if (yb !== ya) return yb - ya;
        const ma = Number(a.subscription_month || 0);
        const mb = Number(b.subscription_month || 0);
        if (mb !== ma) return mb - ma;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      map.set(customerId, sorted[0]);
    });
    return map;
  }, [subsByCustomer]);

  const paidThisMonthIds = useMemo(() => {
    const set = new Set();
    subscriptions.forEach((s) => {
      if (Number(s.subscription_year) === CURRENT_YEAR && Number(s.subscription_month) === CURRENT_MONTH) {
        set.add(s.customer_id);
      }
    });
    return set;
  }, [subscriptions]);

  const summary = useMemo(
    () => ({
      total: customers.length,
      villages: villages.length,
      paidThisMonth: paidThisMonthIds.size
    }),
    [customers, villages, paidThisMonthIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (villageFilter && String(c.village || "").trim() !== villageFilter) return false;
      if (!q) return true;
      const name = String(c.full_name || "").toLowerCase();
      const phone = String(c.phone || "").replace(/[^0-9]/g, "");
      const qDigits = q.replace(/[^0-9]/g, "");
      return name.includes(q) || (qDigits && phone.includes(qDigits));
    });
  }, [customers, search, villageFilter]);

  const addCustomer = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (!fullName) return setError("اسم المشترك مطلوب.");
    if (!phone) return setError("رقم هاتف المشترك مطلوب.");

    setAdding(true);

    const { error: insertError } = await supabase.from("eco_waste_customers").insert({
      full_name: fullName,
      phone,
      village: form.village.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null
    });

    setAdding(false);

    if (insertError) {
      setError(insertError.message || "تعذر إضافة المشترك.");
      return;
    }

    setMsg("تمت إضافة المشترك بنجاح.");
    setForm(initialForm);
    await load();
  };

  const openPayForm = (customerId) => {
    setMsg("");
    setError("");
    if (payForId === customerId) {
      setPayForId("");
      return;
    }
    setPayForId(customerId);
    setPayForm(initialPayForm);
  };

  const savePayment = async (customer) => {
    setMsg("");
    setError("");

    const year = Number(payForm.year);
    const month = Number(payForm.month);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) return setError("سنة الاشتراك غير صحيحة.");
    if (!Number.isInteger(month) || month < 1 || month > 12) return setError("شهر الاشتراك غير صحيح.");
    if (!payForm.paidOn) return setError("تاريخ الدفع مطلوب.");

    const alreadyPaid = (subsByCustomer.get(customer.id) || []).some(
      (s) => Number(s.subscription_year) === year && Number(s.subscription_month) === month
    );
    if (alreadyPaid && !window.confirm("يوجد اشتراك مسجل لهذا المشترك عن نفس الشهر بالفعل. إضافة اشتراك آخر؟")) {
      return;
    }

    setPayingId(customer.id);

    const { error: insertError } = await supabase.from("eco_waste_subscriptions").insert({
      customer_id: customer.id,
      subscription_year: year,
      subscription_month: month,
      paid_on: payForm.paidOn
    });

    setPayingId("");

    if (insertError) {
      setError(insertError.message || "تعذر تسجيل الدفع.");
      return;
    }

    setMsg(`تم تسجيل دفع ${monthLabel(year, month)} للمشترك ${customer.full_name || ""}.`);
    setPayForId("");
    await load();
  };

  const openEdit = (customer) => {
    setMsg("");
    setError("");
    if (editingId === customer.id) {
      setEditingId("");
      return;
    }
    setEditingId(customer.id);
    setEditForm({
      fullName: customer.full_name || "",
      phone: customer.phone || "",
      village: customer.village || "",
      address: customer.address || "",
      notes: customer.notes || ""
    });
  };

  const saveEdit = async (customer) => {
    setMsg("");
    setError("");

    const fullName = editForm.fullName.trim();
    const phone = editForm.phone.trim();

    if (!fullName) return setError("اسم المشترك مطلوب.");
    if (!phone) return setError("رقم هاتف المشترك مطلوب.");

    setSavingEdit(true);

    const { error: updateError } = await supabase
      .from("eco_waste_customers")
      .update({
        full_name: fullName,
        phone,
        village: editForm.village.trim() || null,
        address: editForm.address.trim() || null,
        notes: editForm.notes.trim() || null
      })
      .eq("id", customer.id);

    setSavingEdit(false);

    if (updateError) {
      setError(updateError.message || "تعذر تعديل بيانات المشترك.");
      return;
    }

    setMsg(`تم تعديل بيانات المشترك ${fullName}.`);
    setEditingId("");
    await load();
  };

  const deleteCustomer = async (customer) => {
    const subsCount = (subsByCustomer.get(customer.id) || []).length;
    const confirmed = window.confirm(
      `حذف المشترك "${customer.full_name || ""}"؟ هيتم حذف كل اشتراكاته المسجلة (${subsCount}) معاه، والحذف ده مش هيتراجع فيه.`
    );
    if (!confirmed) return;

    setMsg("");
    setError("");
    setDeletingId(customer.id);

    const { error: subsDeleteError } = await supabase
      .from("eco_waste_subscriptions")
      .delete()
      .eq("customer_id", customer.id);

    if (subsDeleteError) {
      setDeletingId("");
      setError(subsDeleteError.message || "تعذر حذف اشتراكات المشترك.");
      return;
    }

    const { error: deleteError } = await supabase.from("eco_waste_customers").delete().eq("id", customer.id);

    setDeletingId("");

    if (deleteError) {
      setError(deleteError.message || "تعذر حذف المشترك.");
      return;
    }

    if (editingId === customer.id) setEditingId("");
    if (historyForId === customer.id) setHistoryForId("");
    if (payForId === customer.id) setPayForId("");

    setMsg(`تم حذف المشترك ${customer.full_name || ""} وكل اشتراكاته.`);
    await load();
  };

  const toggleHistory = (customerId) => {
    setMsg("");
    setError("");
    setEditingSubId("");
    setHistoryForId((prev) => (prev === customerId ? "" : customerId));
  };

  const openSubEdit = (sub) => {
    setMsg("");
    setError("");
    setEditingSubId(sub.id);
    setSubEditForm({
      year: String(sub.subscription_year || CURRENT_YEAR),
      month: String(sub.subscription_month || CURRENT_MONTH),
      paidOn: sub.paid_on || todayIso()
    });
  };

  const saveSubEdit = async (sub) => {
    setMsg("");
    setError("");

    const year = Number(subEditForm.year);
    const month = Number(subEditForm.month);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) return setError("سنة الاشتراك غير صحيحة.");
    if (!Number.isInteger(month) || month < 1 || month > 12) return setError("شهر الاشتراك غير صحيح.");
    if (!subEditForm.paidOn) return setError("تاريخ الدفع مطلوب.");

    setSavingSubId(sub.id);

    const { error: updateError } = await supabase
      .from("eco_waste_subscriptions")
      .update({
        subscription_year: year,
        subscription_month: month,
        paid_on: subEditForm.paidOn
      })
      .eq("id", sub.id);

    setSavingSubId("");

    if (updateError) {
      setError(updateError.message || "تعذر تعديل الدفعة.");
      return;
    }

    setMsg(`تم تعديل الدفعة إلى ${monthLabel(year, month)}.`);
    setEditingSubId("");
    await load();
  };

  const deleteSub = async (sub) => {
    const confirmed = window.confirm(
      `حذف دفعة اشتراك ${monthLabel(sub.subscription_year, sub.subscription_month)}؟ الحذف ده مش هيتراجع فيه.`
    );
    if (!confirmed) return;

    setMsg("");
    setError("");
    setDeletingSubId(sub.id);

    const { error: deleteError } = await supabase.from("eco_waste_subscriptions").delete().eq("id", sub.id);

    setDeletingSubId("");

    if (deleteError) {
      setError(deleteError.message || "تعذر حذف الدفعة.");
      return;
    }

    if (editingSubId === sub.id) setEditingSubId("");
    setMsg(`تم حذف دفعة اشتراك ${monthLabel(sub.subscription_year, sub.subscription_month)}.`);
    await load();
  };

  return (
    <section className="page">
      <h1>مشتركين التجميع</h1>
      <p className="muted">مشتركو خدمة جمع المخلفات من المنازل وحالة اشتراكاتهم الشهرية.</p>

      {msg ? <p className="success">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="grid-3">
        <div className="card">
          <h3>إجمالي المشتركين</h3>
          <p className="big">{summary.total.toLocaleString("ar-EG")}</p>
        </div>
        <div className="card">
          <h3>عدد القرى</h3>
          <p className="big">{summary.villages.toLocaleString("ar-EG")}</p>
        </div>
        <div className="card">
          <h3>مدفوع هذا الشهر ({monthLabel(CURRENT_YEAR, CURRENT_MONTH)})</h3>
          <p className="big">{summary.paidThisMonth.toLocaleString("ar-EG")}</p>
        </div>
      </div>

      <form className="card" onSubmit={addCustomer}>
        <h3>إضافة مشترك جديد</h3>
        <label>
          الاسم بالكامل
          <input
            value={form.fullName}
            onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            required
          />
        </label>
        <label>
          رقم الهاتف
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />
        </label>
        <label>
          القرية
          <input
            list="subscriber-villages"
            value={form.village}
            onChange={(e) => setForm((p) => ({ ...p, village: e.target.value }))}
            placeholder="اختر قرية موجودة أو اكتب قرية جديدة"
          />
          <datalist id="subscriber-villages">
            {villages.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <label>
          العنوان (اختياري)
          <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </label>
        <label>
          ملحوظات (اختياري)
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
          />
        </label>
        <button className="btn" type="submit" disabled={adding}>
          {adding ? "جاري الإضافة..." : "إضافة المشترك"}
        </button>
      </form>

      <div className="card">
        <h3>بحث وتصفية</h3>
        <div className="grid-2">
          <label>
            بحث بالاسم أو رقم الهاتف
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اكتب اسم المشترك أو رقم هاتفه"
            />
          </label>
          <label>
            القرية
            <select value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}>
              <option value="">كل القرى</option>
              {villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          عرض {filtered.length.toLocaleString("ar-EG")} من {customers.length.toLocaleString("ar-EG")} مشترك.
        </p>
      </div>

      {loading ? <p className="muted">جاري التحميل...</p> : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>القرية</th>
              <th>العنوان</th>
              <th>حالة الاشتراك</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => {
              const latest = latestSubByCustomer.get(customer.id);
              const paidThisMonth = paidThisMonthIds.has(customer.id);
              const paying = payingId === customer.id;
              return [
                <tr key={customer.id}>
                  <td>{customer.full_name || "-"}</td>
                  <td>{customer.phone || "-"}</td>
                  <td>{customer.village || "-"}</td>
                  <td>{customer.address || "-"}</td>
                  <td>
                    {paidThisMonth ? (
                      <span className="badge">مدفوع هذا الشهر</span>
                    ) : latest ? (
                      <span>
                        آخر دفع: {monthLabel(latest.subscription_year, latest.subscription_month)}
                        {latest.paid_on ? <span className="muted"> ({formatDate(latest.paid_on)})</span> : null}
                      </span>
                    ) : (
                      <span className="muted">بدون اشتراكات</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => openPayForm(customer.id)}
                      disabled={paying}
                    >
                      تسجيل دفع
                    </button>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => openEdit(customer)}
                      disabled={deletingId === customer.id}
                    >
                      تعديل
                    </button>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => toggleHistory(customer.id)}
                    >
                      الاشتراكات ({(subsByCustomer.get(customer.id) || []).length.toLocaleString("ar-EG")})
                    </button>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => deleteCustomer(customer)}
                      disabled={deletingId === customer.id}
                    >
                      {deletingId === customer.id ? "جاري الحذف..." : "حذف"}
                    </button>
                  </td>
                </tr>,
                payForId === customer.id ? (
                  <tr key={`${customer.id}-pay`}>
                    <td colSpan={6}>
                      <div className="grid-3" style={{ alignItems: "end" }}>
                        <label>
                          السنة
                          <input
                            type="number"
                            min="2000"
                            max="2100"
                            value={payForm.year}
                            onChange={(e) => setPayForm((p) => ({ ...p, year: e.target.value }))}
                            disabled={paying}
                          />
                        </label>
                        <label>
                          الشهر
                          <select
                            value={payForm.month}
                            onChange={(e) => setPayForm((p) => ({ ...p, month: e.target.value }))}
                            disabled={paying}
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <option key={name} value={idx + 1}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          تاريخ الدفع
                          <input
                            type="date"
                            value={payForm.paidOn}
                            onChange={(e) => setPayForm((p) => ({ ...p, paidOn: e.target.value }))}
                            disabled={paying}
                          />
                        </label>
                      </div>
                      <div className="split">
                        <button className="btn btn-small" onClick={() => savePayment(customer)} disabled={paying}>
                          {paying ? "جاري الحفظ..." : "حفظ الدفع"}
                        </button>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => setPayForId("")}
                          disabled={paying}
                        >
                          إلغاء
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null,
                editingId === customer.id ? (
                  <tr key={`${customer.id}-edit`}>
                    <td colSpan={6}>
                      <h4 style={{ marginTop: 0 }}>تعديل بيانات المشترك</h4>
                      <div className="grid-2">
                        <label>
                          الاسم بالكامل
                          <input
                            value={editForm.fullName}
                            onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                            disabled={savingEdit}
                          />
                        </label>
                        <label>
                          رقم الهاتف
                          <input
                            value={editForm.phone}
                            onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                            disabled={savingEdit}
                          />
                        </label>
                        <label>
                          القرية
                          <input
                            list="subscriber-villages"
                            value={editForm.village}
                            onChange={(e) => setEditForm((p) => ({ ...p, village: e.target.value }))}
                            placeholder="اختر قرية موجودة أو اكتب قرية جديدة"
                            disabled={savingEdit}
                          />
                        </label>
                        <label>
                          العنوان (اختياري)
                          <input
                            value={editForm.address}
                            onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                            disabled={savingEdit}
                          />
                        </label>
                      </div>
                      <label>
                        ملحوظات (اختياري)
                        <textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                          rows={2}
                          disabled={savingEdit}
                        />
                      </label>
                      <div className="split">
                        <button className="btn btn-small" onClick={() => saveEdit(customer)} disabled={savingEdit}>
                          {savingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}
                        </button>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => setEditingId("")}
                          disabled={savingEdit}
                        >
                          إلغاء
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null,
                historyForId === customer.id ? (
                  <tr key={`${customer.id}-history`}>
                    <td colSpan={6}>
                      <h4 style={{ marginTop: 0 }}>سجل اشتراكات {customer.full_name || ""}</h4>
                      {(subsByCustomer.get(customer.id) || []).length ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          {(subsByCustomer.get(customer.id) || []).map((sub) =>
                            editingSubId === sub.id ? (
                              <div
                                key={sub.id}
                                style={{
                                  border: "1px solid rgba(20,108,57,.25)",
                                  borderRadius: 14,
                                  padding: 12
                                }}
                              >
                                <div className="grid-3" style={{ alignItems: "end" }}>
                                  <label>
                                    السنة
                                    <input
                                      type="number"
                                      min="2000"
                                      max="2100"
                                      value={subEditForm.year}
                                      onChange={(e) =>
                                        setSubEditForm((p) => ({ ...p, year: e.target.value }))
                                      }
                                      disabled={savingSubId === sub.id}
                                    />
                                  </label>
                                  <label>
                                    الشهر
                                    <select
                                      value={subEditForm.month}
                                      onChange={(e) =>
                                        setSubEditForm((p) => ({ ...p, month: e.target.value }))
                                      }
                                      disabled={savingSubId === sub.id}
                                    >
                                      {MONTH_NAMES.map((name, idx) => (
                                        <option key={name} value={idx + 1}>
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    تاريخ الدفع
                                    <input
                                      type="date"
                                      value={subEditForm.paidOn}
                                      onChange={(e) =>
                                        setSubEditForm((p) => ({ ...p, paidOn: e.target.value }))
                                      }
                                      disabled={savingSubId === sub.id}
                                    />
                                  </label>
                                </div>
                                <div className="split">
                                  <button
                                    className="btn btn-small"
                                    onClick={() => saveSubEdit(sub)}
                                    disabled={savingSubId === sub.id}
                                  >
                                    {savingSubId === sub.id ? "جاري الحفظ..." : "حفظ الدفعة"}
                                  </button>
                                  <button
                                    className="btn btn-outline btn-small"
                                    onClick={() => setEditingSubId("")}
                                    disabled={savingSubId === sub.id}
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={sub.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
                                  flexWrap: "wrap",
                                  border: "1px solid rgba(20,108,57,.16)",
                                  borderRadius: 14,
                                  padding: "10px 12px"
                                }}
                              >
                                <span>
                                  <strong>{monthLabel(sub.subscription_year, sub.subscription_month)}</strong>
                                  <span className="muted"> — دفع بتاريخ {formatDate(sub.paid_on)}</span>
                                </span>
                                <span className="actions-cell">
                                  <button
                                    className="btn btn-outline btn-small"
                                    onClick={() => openSubEdit(sub)}
                                    disabled={deletingSubId === sub.id}
                                  >
                                    تعديل
                                  </button>
                                  <button
                                    className="btn btn-outline btn-small"
                                    onClick={() => deleteSub(sub)}
                                    disabled={deletingSubId === sub.id}
                                  >
                                    {deletingSubId === sub.id ? "جاري الحذف..." : "حذف"}
                                  </button>
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="muted" style={{ margin: 0 }}>
                          لا توجد اشتراكات مسجلة لهذا المشترك.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : null
              ];
            })}
          </tbody>
        </table>
        {!filtered.length && !loading ? (
          <p className="muted">
            {customers.length
              ? "لا توجد نتائج مطابقة للبحث أو التصفية الحالية."
              : "لا توجد بيانات مشتركين للعرض حاليًا. إذا كنت تتوقع وجود بيانات، فقد تكون مقيدة بصلاحيات الوصول (RLS) لهذا الحساب."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
