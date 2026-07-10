import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PointsBadge from "./PointsBadge";
import { roles } from "../lib/supabase";

const rdcLogoUrl = "https://hu.edu.eg/wp-content/uploads/2024/09/rural-development-center.webp";
const appLogoUrl = "/icons/nuqta-logo.png";
const rdcLogoFallback = "/icons/icon-192.png";

const roleLinks = {
  [roles.COLLECTOR]: [
    { to: "/collector", label: "الرئيسية" },
    { to: "/collector/add", label: "إضافة عملية" }
  ],
  [roles.USER]: [
    { to: "/user", label: "الرئيسية" },
    { to: "/user/transfer", label: "تحويل نقاط" }
  ],
  [roles.PARTNER]: [{ to: "/partner", label: "الرئيسية" }],
  [roles.ADMIN]: [
    { to: "/admin", label: "لوحة التحكم" },
    { to: "/admin/prices", label: "إدارة الأسعار" },
    { to: "/admin/stores", label: "إدارة المحلات" },
    { to: "/admin/transactions", label: "إدارة المعاملات" },
    { to: "/admin/leagues", label: "الدوريات الأسبوعية" },
    { to: "/admin/settlements", label: "التسويات المالية" }
  ]
};

const roleLabel = {
  [roles.USER]: "مستخدم",
  [roles.COLLECTOR]: "محل تجميع",
  [roles.PARTNER]: "محل شريك",
  [roles.ADMIN]: "مشرف"
};

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const usesBottomDock = [roles.USER, roles.PARTNER, roles.COLLECTOR, roles.ADMIN].includes(profile?.role);
  const isUserRole = profile?.role === roles.USER;
  const links = usesBottomDock ? [] : roleLinks[profile?.role] || [];

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className={`navbar ${isUserRole ? "navbar-user" : ""}`}>
      <div className="brand">
        <img className="brand-logo" src={appLogoUrl} alt="" aria-hidden="true" />
        <span>نقطة خضراء</span>
      </div>

      {links.length ? (
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>
      ) : null}

      {isUserRole ? (
        <div className="navbar-center-points">
          <PointsBadge points={profile?.points || 0} className="badge-prominent" />
        </div>
      ) : null}

      <div className="nav-actions">
        {!isUserRole ? (
          <a className="powered-by powered-by-nav" href="https://hu.edu.eg/" target="_blank" rel="noreferrer">
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
        ) : null}

        <div className="account-mini">
          <strong>{profile?.store_name || profile?.name || "بدون اسم"}</strong>
          <small>{roleLabel[profile?.role] || "-"}</small>
        </div>
        {!isUserRole ? <PointsBadge points={profile?.points || 0} /> : null}

        {!usesBottomDock ? (
          <button className="btn btn-outline" onClick={onLogout}>
            خروج
          </button>
        ) : null}
      </div>
    </header>
  );
}
