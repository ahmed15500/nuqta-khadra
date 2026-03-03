import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const rdcLogoUrl = "https://hu.edu.eg/wp-content/uploads/2024/09/rural-development-center.webp";
const rdcLogoFallback = "/icons/icon-192.svg";

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
        <div className="auth-brand auth-brand-login">
          <div className="auth-brand-copy">
            <h1>Waste Miza</h1>
            <p className="auth-tagline-en">Turn your waste into rewards</p>
          </div>
        </div>

        <a className="powered-by auth-powered" href="https://hu.edu.eg/" target="_blank" rel="noreferrer">
          <img
            src={rdcLogoUrl}
            alt="Rural Development Center - Heliopolis University"
            className="powered-logo"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.src.endsWith(rdcLogoFallback)) return;
              e.currentTarget.src = rdcLogoFallback;
            }}
          />
          <span className="powered-copy powered-copy-en" lang="en" dir="ltr">
            <small>Powered by</small>
            <strong>Rural Development Center - Heliopolis University</strong>
          </span>
        </a>

        <label>
          رقم الهاتف
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
        </label>

        <label>
          كلمة المرور
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button className="btn" disabled={loading}>
          {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </button>

        <p className="muted">
          مستخدم جديد؟ <Link to="/register">إنشاء حساب</Link>
        </p>
      </form>
    </main>
  );
}
