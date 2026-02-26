import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PointsBadge from "./PointsBadge";
import { roles } from "../lib/supabase";

const rdcLogoUrl = "https://hu.edu.eg/wp-content/uploads/2024/09/rural-development-center.webp";

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
    { to: "/admin/transactions", label: "إدارة المعاملات" }
  ]
};

const roleLabel = {
  [roles.USER]: "مستخدم",
  [roles.COLLECTOR]: "محل جمع",
  [roles.PARTNER]: "محل شريك",
  [roles.ADMIN]: "مشرف"
};

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const links = roleLinks[profile?.role] || [];

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="navbar">
      <div className="brand">نقطة خضراء</div>
      <nav>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="nav-link">
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-actions">
        <a className="powered-by powered-by-nav" href="https://hu.edu.eg/" target="_blank" rel="noreferrer">
          <img
            src={rdcLogoUrl}
            alt="Rural Development Center - Heliopolis University"
            className="powered-logo"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="powered-copy">
            <small>Powered by</small>
            <strong>RDC - HU</strong>
          </span>
        </a>

        <div className="account-mini">
          <strong>{profile?.store_name || profile?.name || "بدون اسم"}</strong>
          <small>{roleLabel[profile?.role] || "-"}</small>
        </div>
        <PointsBadge points={profile?.points || 0} />
        <button className="btn btn-outline" onClick={onLogout}>
          خروج
        </button>
      </div>
    </header>
  );
}
