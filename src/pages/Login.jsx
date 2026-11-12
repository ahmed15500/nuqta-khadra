import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Gift,
  LockKeyhole,
  Phone,
  Recycle,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const appLogoUrl = (import.meta.env.BASE_URL + "icons/nuqta-logo.png");

export default function Login() {
  const { login, session, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!session || !profile?.role) return;
    const prefix = profile.role.split("_")[0];
    navigate(`/${prefix}`);
  }, [session, profile?.role, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message || "فشل تسجيل الدخول. راجع رقم الهاتف وكلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page" dir="rtl" lang="ar">
      <style>{loginStyles}</style>

      <section className="login-shell" aria-label="تسجيل الدخول إلى EcoWasteAI">
        <aside className="login-hero">
          <div className="login-hero-glow login-hero-glow-one" />
          <div className="login-hero-glow login-hero-glow-two" />

          <div className="login-brand-mark" aria-hidden="true">
            <img className="login-brand-image" src={appLogoUrl} alt="" />
          </div>

          <div className="login-hero-copy">
            <span className="login-eyebrow">ECOWASTEAI</span>
            <h1>EcoWasteAI</h1>
            <p>حوّل مخلفاتك إلى نقاط ومكافآت، وشارك في بناء مجتمع أنظف وأكثر استدامة.</p>
          </div>

          <div className="login-benefits" aria-label="مزايا المنصة">
            <div className="login-benefit">
              <Recycle size={21} />
              <span>سجّل مخلفاتك بسهولة</span>
            </div>
            <div className="login-benefit">
              <Gift size={21} />
              <span>اجمع النقاط واستبدلها</span>
            </div>
            <div className="login-benefit">
              <ShieldCheck size={21} />
              <span>حساب آمن وموثوق</span>
            </div>
          </div>
        </aside>

        <form className="login-form-panel" onSubmit={onSubmit} noValidate>
          <div className="login-mobile-brand">
            <div className="login-mobile-logo" aria-hidden="true">
              <img className="login-mobile-logo-image" src={appLogoUrl} alt="" />
            </div>
            <div>
              <strong>EcoWasteAI</strong>
              <small>Waste to Value</small>
            </div>
          </div>

          <header className="login-form-header">
            <span className="login-welcome">مرحبًا بعودتك</span>
            <h2>تسجيل الدخول</h2>
            <p>أدخل بيانات حسابك للمتابعة إلى لوحة التحكم.</p>
          </header>

          <div className="login-field-group">
            <label htmlFor="login-phone">رقم الهاتف</label>
            <div className="login-input-wrap">
              <Phone className="login-input-icon" size={20} aria-hidden="true" />
              <input
                id="login-phone"
                className="login-input login-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
                required
                aria-invalid={Boolean(error)}
              />
            </div>
          </div>

          <div className="login-field-group">
            <label htmlFor="login-password">كلمة المرور</label>
            <div className="login-input-wrap">
              <LockKeyhole className="login-input-icon" size={20} aria-hidden="true" />
              <input
                id="login-password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                required
                aria-invalid={Boolean(error)}
              />
              <button
                className="login-password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="login-submit" type="submit" disabled={loading}>
            <span>{loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}</span>
            <ArrowLeft size={19} aria-hidden="true" />
          </button>

          <p className="login-register-copy">
            ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link>
          </p>

          <div className="login-powered">
            <span className="sadeem-mark" aria-hidden="true">
              سديم
            </span>
            <span>
              <small>بدعم من</small>
              <strong>سديم للابتكار وحلول الاستدامة</strong>
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}

const loginStyles = `
  .login-page {
    min-height: calc(100dvh - var(--safe-top) - var(--safe-bottom));
    display: grid;
    place-items: center;
    padding: clamp(10px, 2.5vw, 32px);
  }

  .login-shell {
    width: min(100%, 980px);
    min-height: 610px;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
    overflow: hidden;
    border-radius: 30px;
    border: 1px solid rgba(20, 108, 57, 0.3);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 26px 70px rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(16px);
  }

  .login-hero {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 34px;
    padding: clamp(34px, 5vw, 58px);
    color: #fff;
    background:
      linear-gradient(145deg, rgba(13, 84, 42, 0.98), rgba(20, 108, 57, 0.97) 55%, rgba(34, 163, 85, 0.95)),
      radial-gradient(circle at 20% 15%, rgba(61, 90, 118, 0.25), transparent 36%);
  }

  .login-hero::after {
    content: "";
    position: absolute;
    inset: auto -65px -70px auto;
    width: 245px;
    height: 245px;
    border: 1px solid rgba(20, 108, 57, 0.16);
    border-radius: 50%;
    box-shadow: 0 0 0 38px rgba(20, 108, 57, 0.05), 0 0 0 76px rgba(20, 108, 57, 0.035);
  }

  .login-hero-glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(2px);
  }

  .login-hero-glow-one {
    width: 190px;
    height: 190px;
    top: -90px;
    left: -70px;
    background: rgba(20, 108, 57, 0.18);
  }

  .login-hero-glow-two {
    width: 160px;
    height: 160px;
    right: 40px;
    bottom: 120px;
    background: rgba(61, 90, 118, 0.25);
  }

  .login-brand-mark {
    position: relative;
    z-index: 1;
    width: 68px;
    height: 68px;
    overflow: hidden;
    border-radius: 20px;
    background: transparent;
    border: 1px solid rgba(20, 108, 57, 0.45);
    box-shadow: 0 12px 28px rgba(23, 61, 39, 0.14);
  }

  .login-brand-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .login-hero-copy {
    position: relative;
    z-index: 1;
  }

  .login-eyebrow {
    display: inline-block;
    margin-bottom: 12px;
    color: #22a355;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .login-hero-copy h1 {
    margin: 0;
    font-size: clamp(2.5rem, 5vw, 4rem);
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: -1px;
  }

  .login-hero-copy p {
    max-width: 440px;
    margin: 20px 0 0;
    color: rgba(243, 239, 233, 0.78);
    font-size: 1.04rem;
    line-height: 1.9;
  }

  .login-benefits {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 11px;
  }

  .login-benefit {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border-radius: 15px;
    color: rgba(243, 239, 233, 0.92);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(20, 108, 57, 0.22);
    font-size: 0.92rem;
    font-weight: 750;
  }

  .login-form-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(30px, 5vw, 56px);
    background:
      radial-gradient(circle at 95% 5%, rgba(61, 90, 118, 0.18), transparent 28%),
      linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
  }

  .login-mobile-brand {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 30px;
  }

  .login-mobile-logo {
    width: 48px;
    height: 48px;
    overflow: hidden;
    border-radius: 16px;
    background: transparent;
    border: 1px solid rgba(20, 108, 57, 0.4);
    box-shadow: 0 8px 18px rgba(23, 61, 39, 0.12);
  }

  .login-mobile-logo-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .login-mobile-brand strong,
  .login-mobile-brand small {
    display: block;
  }

  .login-mobile-brand strong {
    color: var(--green-950);
    font-size: 1.02rem;
  }

  .login-mobile-brand small {
    margin-top: 2px;
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.7px;
  }

  .login-form-header {
    margin-bottom: 30px;
  }

  .login-welcome {
    display: inline-flex;
    margin-bottom: 8px;
    color: var(--olive-700);
    font-size: 0.88rem;
    font-weight: 900;
  }

  .login-form-header h2 {
    margin: 0;
    color: var(--green-950);
    font-size: clamp(1.8rem, 3vw, 2.3rem);
    line-height: 1.2;
  }

  .login-form-header p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .login-field-group {
    margin-bottom: 17px;
  }

  .login-field-group label {
    display: block;
    margin: 0 0 8px;
    color: var(--green-950);
    font-size: 0.9rem;
    font-weight: 850;
  }

  .login-input-wrap {
    position: relative;
  }

  .login-input-icon {
    position: absolute;
    top: 50%;
    right: 15px;
    z-index: 1;
    color: #5c7a67;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .login-input {
    width: 100%;
    min-height: 54px;
    padding: 12px 48px 12px 46px;
    border: 1px solid rgba(92, 122, 103, 0.25);
    border-radius: 16px;
    color: var(--green-950);
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    font: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .login-input::placeholder {
    color: rgba(92, 122, 103, 0.55);
  }

  .login-input:focus {
    outline: none;
    border-color: rgba(20, 108, 57, 0.8);
    box-shadow: 0 0 0 4px rgba(20, 108, 57, 0.15), 0 8px 18px rgba(0, 0, 0, 0.3);
  }

  .login-phone-input {
    direction: ltr;
    text-align: right;
  }

  .login-password-toggle {
    position: absolute;
    top: 50%;
    left: 10px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 11px;
    color: #5c7a67;
    background: transparent;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .login-password-toggle:hover,
  .login-password-toggle:focus-visible {
    color: var(--green-900);
    background: var(--mint-100);
    outline: none;
  }

  .login-error {
    margin: 0 0 16px;
    padding: 11px 13px;
    border: 1px solid rgba(229, 96, 79, 0.35);
    border-radius: 13px;
    color: var(--danger);
    background: rgba(229, 96, 79, 0.1);
    font-size: 0.86rem;
    font-weight: 750;
    line-height: 1.6;
  }

  .login-submit {
    width: 100%;
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 3px;
    padding: 12px 18px;
    border: 0;
    border-radius: 16px;
    color: #ffffff;
    background: #146c39;
    box-shadow: 0 12px 24px rgba(20, 108, 57, 0.25);
    font: inherit;
    font-weight: 900;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
  }

  .login-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #1d8a49;
    box-shadow: 0 15px 28px rgba(20, 108, 57, 0.35);
  }

  .login-submit:focus-visible {
    outline: 3px solid rgba(20, 108, 57, 0.4);
    outline-offset: 3px;
  }

  .login-submit:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .login-register-copy {
    margin: 20px 0 0;
    color: var(--muted);
    text-align: center;
    font-size: 0.91rem;
  }

  .login-register-copy a {
    color: var(--green-900);
    font-weight: 900;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }

  .login-powered {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid rgba(92, 122, 103, 0.15);
    color: inherit;
    text-decoration: none;
  }

  .login-powered .sadeem-mark {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    border-radius: 11px;
    font-size: 0.8rem;
  }

  .login-powered span,
  .login-powered small,
  .login-powered strong {
    display: block;
  }

  .login-powered small {
    margin-bottom: 2px;
    color: var(--muted);
    font-size: 0.65rem;
  }

  .login-powered strong {
    color: var(--green-950);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  @media (max-width: 780px) {
    .login-page {
      padding: 6px;
    }

    .login-shell {
      min-height: auto;
      grid-template-columns: 1fr;
      border-radius: 24px;
    }

    .login-hero {
      display: none;
    }

    .login-form-panel {
      min-height: calc(100dvh - 28px - var(--safe-top) - var(--safe-bottom));
      justify-content: center;
      padding: clamp(26px, 7vw, 42px) clamp(20px, 6vw, 36px);
    }

    .login-mobile-brand {
      display: flex;
    }
  }

  @media (max-width: 420px) {
    .login-form-panel {
      padding-inline: 18px;
    }

    .login-form-header {
      margin-bottom: 24px;
    }

    .login-powered {
      align-items: flex-start;
    }
  }
`;
