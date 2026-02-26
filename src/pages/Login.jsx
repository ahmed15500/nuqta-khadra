import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, session, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !profile?.role) return;
    const prefix = profile.role.split("_")[0];
    navigate(`/${prefix}`);
  }, [session, profile?.role, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>تسجيل الدخول</h1>
        <label>
          رقم التليفون
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
        </label>
        <label>
          كلمة السر
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" disabled={loading}>
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
        <p className="muted">
          مستخدم جديد؟ <Link to="/register">إنشاء حساب</Link>
        </p>
      </form>
    </main>
  );
}
