import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const rdcLogoUrl = "https://hu.edu.eg/wp-content/uploads/2024/09/rural-development-center.webp";
const appLogoUrl = "/icons/nuqta-logo.png";
const rdcLogoFallback = "/icons/icon-192.png";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await register(form);
      navigate("/login");
    } catch (err) {
      setError(err.message || "فشل التسجيل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="auth-app-brand">
          <img src={appLogoUrl} alt="" aria-hidden="true" />
          <span>
            <strong>نقطة خضراء</strong>
            <small>Nuqta Khadra</small>
          </span>
        </div>
        <h1>إنشاء حساب مستخدم</h1>

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
          الاسم
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </label>

        <label>
          رقم التليفون
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
        </label>

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

        <p className="muted">حسابات المحلات يتم إنشاؤها واعتمادها من الإدارة فقط.</p>

        {error ? <p className="error">{error}</p> : null}

        <button className="btn" disabled={loading}>
          {loading ? "جاري الإنشاء..." : "إنشاء"}
        </button>

        <p className="muted">
          لديك حساب؟ <Link to="/login">تسجيل الدخول</Link>
        </p>
      </form>
    </main>
  );
}
