import {
  CircleDollarSign,
  Home,
  List,
  LogOut,
  PlusCircle,
  Repeat2,
  Settings2,
  Store,
  Trophy,
  WalletCards
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { roles } from "../lib/supabase";

const roleItems = {
  [roles.USER]: [
    { key: "home", to: "/user", label: "الرئيسية", icon: Home, end: true },
    { key: "transfer", to: "/user/transfer", label: "التحويل", icon: Repeat2 },
    { key: "tx", to: "/user/transactions", label: "المعاملات", icon: List },
    { key: "settings", to: "/user/settings", label: "الإعدادات", icon: Settings2 }
  ],
  [roles.COLLECTOR]: [
    { key: "home", to: "/collector", label: "الرئيسية", icon: Home, end: true },
    { key: "add", to: "/collector/add", label: "إضافة", icon: PlusCircle }
  ],
  [roles.PARTNER]: [{ key: "home", to: "/partner", label: "الرئيسية", icon: Store, end: true }],
  [roles.ADMIN]: [
    { key: "home", to: "/admin", label: "الرئيسية", icon: Home, end: true },
    { key: "prices", to: "/admin/prices", label: "الأسعار", icon: WalletCards },
    { key: "stores", to: "/admin/stores", label: "المحلات", icon: Store },
    { key: "tx", to: "/admin/transactions", label: "المعاملات", icon: Settings2 },
    { key: "leagues", to: "/admin/leagues", label: "الدوريات", icon: Trophy },
    { key: "settlements", to: "/admin/settlements", label: "التسوية", icon: CircleDollarSign }
  ]
};

export default function UserBottomDock() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const items = roleItems[profile?.role] || [];

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (!items.length) return null;

  const gridColumns = items.length + 1;

  return (
    <footer className="user-bottom-dock" aria-label="التنقل السريع">
      <div className="user-bottom-dock-grid" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`}
              aria-label={item.label}
            >
              <span className="dock-icon-wrap">
                <Icon size={22} strokeWidth={2.4} />
              </span>
              <span className="dock-label">{item.label}</span>
            </NavLink>
          );
        })}

        <button type="button" className="dock-item dock-logout" onClick={onLogout} aria-label="خروج">
          <span className="dock-icon-wrap">
            <LogOut size={22} strokeWidth={2.4} />
          </span>
          <span className="dock-label">خروج</span>
        </button>
      </div>
    </footer>
  );
}
