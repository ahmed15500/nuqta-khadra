import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CollectorHome from "./pages/collector/CollectorHome";
import AddWaste from "./pages/collector/AddWaste";
import UserHome from "./pages/user/UserHome";
import Transfer from "./pages/user/Transfer";
import PartnerHome from "./pages/partner/PartnerHome";
import AdminHome from "./pages/admin/AdminHome";
import ManagePrices from "./pages/admin/ManagePrices";
import ManageStores from "./pages/admin/ManageStores";
import ManageTransactions from "./pages/admin/ManageTransactions";
import ProtectedRoute from "./routes/ProtectedRoute";
import { roles } from "./lib/supabase";

const roleHome = {
  [roles.COLLECTOR]: "/collector",
  [roles.USER]: "/user",
  [roles.PARTNER]: "/partner",
  [roles.ADMIN]: "/admin"
};

function RootRedirect() {
  const { session, profile, loading, authError, logout, syncAuthState } = useAuth();

  if (loading) {
    return <StateScreen title="جاري تحميل بيانات الحساب" subtitle="انتظر لحظة..." />;
  }

  if (authError) {
    return (
      <StateScreen
        title="تعذر تحميل الحساب"
        subtitle={authError}
        action={
          <button className="btn" onClick={syncAuthState}>
            إعادة المحاولة
          </button>
        }
      />
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <StateScreen
        title="جاري تجهيز حسابك"
        subtitle="لو استمرت هذه الشاشة، اضغط خروج ثم سجل الدخول مرة أخرى."
        action={
          <button className="btn btn-outline" onClick={logout}>
            خروج
          </button>
        }
      />
    );
  }

  if (profile.disabled) {
    return (
      <StateScreen
        title="الحساب غير مفعل"
        subtitle="تم تعطيل هذا الحساب. برجاء التواصل مع الإدارة."
        action={
          <button className="btn btn-outline" onClick={logout}>
            خروج
          </button>
        }
      />
    );
  }

  return <Navigate to={roleHome[profile.role] || "/login"} replace />;
}

function StateScreen({ title, subtitle, action = null }) {
  return (
    <section className="state-screen">
      <div className="state-panel">
        <span className="state-dot" />
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {action}
      </div>
    </section>
  );
}

export default function App() {
  const { session } = useAuth();
  const location = useLocation();
  const showNavbar = session && location.pathname !== "/admin";

  useEffect(() => {
    const isAdminPage = location.pathname === "/admin";
    document.body.classList.toggle("admin-mode", isAdminPage);
    return () => document.body.classList.remove("admin-mode");
  }, [location.pathname]);

  return (
    <>
      {showNavbar ? <Navbar /> : null}
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/collector"
          element={
            <ProtectedRoute allowedRoles={[roles.COLLECTOR]}>
              <CollectorHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collector/add"
          element={
            <ProtectedRoute allowedRoles={[roles.COLLECTOR]}>
              <AddWaste />
            </ProtectedRoute>
          }
        />

        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRoles={[roles.USER]}>
              <UserHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/transfer"
          element={
            <ProtectedRoute allowedRoles={[roles.USER]}>
              <Transfer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/partner"
          element={
            <ProtectedRoute allowedRoles={[roles.PARTNER]}>
              <PartnerHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <AdminHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/prices"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManagePrices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stores"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManageStores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManageTransactions />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
