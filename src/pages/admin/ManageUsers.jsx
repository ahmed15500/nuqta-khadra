import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const ROLE_LABELS = {
  user: "مستخدم",
  collector_store: "محل تجميع",
  partner_store: "محل شريك",
  admin: "مدير"
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const normalize = (value) => String(value || "").trim().toLowerCase();

export default function ManageUsers() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadAccounts = async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id,name,phone,role,points,store_name,disabled,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (loadError) {
      setError(loadError.message || "تعذر تحميل حسابات المستخدمين.");
      return;
    }

    setAccounts(data || []);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const roles = useMemo(
    () => [...new Set(accounts.map((account) => account.role).filter(Boolean))],
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const term = normalize(search);

    return accounts.filter((account) => {
      const matchesSearch =
        !term ||
        [account.name, account.phone, account.store_name, ROLE_LABELS[account.role]]
          .some((value) => normalize(value).includes(term));
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !account.disabled) ||
        (statusFilter === "disabled" && account.disabled);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((account) => !account.disabled).length,
      disabled: accounts.filter((account) => account.disabled).length
    }),
    [accounts]
  );

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <h1>حسابات المستخدمين</h1>
          <p className="muted">عرض جميع الحسابات المسجلة في البرنامج وبياناتها الأساسية.</p>
        </div>
        <Link to="/admin" className="btn btn-outline">
          العودة للوحة الإدارة
        </Link>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>إجمالي الحسابات</h3>
          <p className="big">{stats.total}</p>
        </div>
        <div className="card">
          <h3>حسابات نشطة</h3>
          <p className="big">{stats.active}</p>
        </div>
        <div className="card">
          <h3>حسابات غير مفعلة</h3>
          <p className="big">{stats.disabled}</p>
        </div>
      </div>

      <div className="card filters">
        <label>
          البحث بالاسم أو رقم الهاتف
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="اكتب الاسم أو رقم الهاتف"
          />
        </label>

        <label>
          نوع الحساب
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">كل الأنواع</option>
            {roles.map((role) => (
              <option value={role} key={role}>
                {ROLE_LABELS[role] || role}
              </option>
            ))}
          </select>
        </label>

        <label>
          الحالة
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="disabled">غير مفعل</option>
          </select>
        </label>

        <button type="button" className="btn btn-outline" onClick={loadAccounts} disabled={loading}>
          تحديث القائمة
        </button>
      </div>

      {loading ? <p className="muted">جاري تحميل الحسابات...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="card table-wrap">
        <div className="section-heading">
          <h3>المستخدمون ({filteredAccounts.length})</h3>
          <p className="muted">كلمات المرور لا تُعرض حفاظًا على أمان الحسابات.</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>رقم الهاتف</th>
              <th>نوع الحساب</th>
              <th>اسم المحل</th>
              <th>النقاط</th>
              <th>تاريخ إنشاء الحساب</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name || "-"}</td>
                <td dir="ltr">{account.phone || "-"}</td>
                <td>{ROLE_LABELS[account.role] || account.role || "-"}</td>
                <td>{account.store_name || "-"}</td>
                <td>{Number(account.points || 0)}</td>
                <td>{formatDate(account.created_at)}</td>
                <td>{account.disabled ? "غير مفعل" : "نشط"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filteredAccounts.length && !loading && !error ? (
          <p className="muted">لا توجد حسابات مطابقة للبحث.</p>
        ) : null}
      </div>
    </section>
  );
}
