import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const appLogoUrl = (import.meta.env.BASE_URL + "icons/nuqta-logo.png");

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
            <strong>EcoWasteAI</strong>
            <small>Waste to Value</small>
          </span>
        </div>
        <h1>إنشاء حساب مستخدم</h1>

        <div className="powered-by auth-powered">
          <span className="powered-logo sadeem-mark" aria-hidden="true">
            سديم
          </span>
          <span className="powered-copy powered-copy-en" lang="en" dir="ltr">
            <small>Powered by</small>
            <strong>SADEEM for Innovation and Sustainability Solutions</strong>
          </span>
        </div>

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
