import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import PointsBadge from "./PointsBadge";
import { roles } from "../lib/supabase";

const roleLinks = {
  [roles.COLLECTOR]: [
    { to: "/collector", label: "الرئيسية" },
    { to: "/collector/add", label: "اضافة عملية" }
  ],
  [roles.USER]: [
    { to: "/user", label: "الرئيسية" },
    { to: "/user/transfer", label: "تحويل نقاط" }
  ],
  [roles.PARTNER]: [{ to: "/partner", label: "الرئيسية" }],
  [roles.ADMIN]: [
    { to: "/admin", label: "لوحة التحكم" },
    { to: "/admin/prices", label: "ادارة الاسعار" },
    { to: "/admin/stores", label: "ادارة المحلات" },
    { to: "/admin/transactions", label: "ادارة المعاملات" }
  ]
};

const roleLabel = {
  [roles.USER]: "مستخدم",
  [roles.COLLECTOR]: "محل جمع",
  [roles.PARTNER]: "محل شريك",
  [roles.ADMIN]: "ادمن"
};

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const links = roleLinks[profile?.role] || [];

  const onLogout = async () => {
    await logout();
    navigate("/login");
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
