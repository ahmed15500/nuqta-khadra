import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppUpdateNotice from "./components/AppUpdateNotice";
import IncomingTransferNotice from "./components/IncomingTransferNotice";
import UserBottomDock from "./components/UserBottomDock";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CollectorHome from "./pages/collector/CollectorHome";
import AddWaste from "./pages/collector/AddWaste";
import UserHome from "./pages/user/UserHome";
import Transfer from "./pages/user/Transfer";
import UserTransactions from "./pages/user/UserTransactions";
import UserSettings from "./pages/user/UserSettings";
import PartnerHome from "./pages/partner/PartnerHome";
import AdminHome from "./pages/admin/AdminHome";
import ManageUsers from "./pages/admin/ManageUsers";
import ManagePrices from "./pages/admin/ManagePrices";
import ManageStores from "./pages/admin/ManageStores";
import ManageTransactions from "./pages/admin/ManageTransactions";
import ManageSettlements from "./pages/admin/ManageSettlements";
import ManageLeagues from "./pages/admin/ManageLeagues";
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
  const shouldBlockAuthError = Boolean(authError && (!session || !profile));

  if (loading) {
    return <StateScreen title="جاري تحميل بيانات الحساب" subtitle="انتظر لحظة..." />;
  }

  if (shouldBlockAuthError) {
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
  const { session, profile } = useAuth();
  const showNavbar = session;
  const showBottomDock = Boolean(
    session &&
      [roles.USER, roles.PARTNER, roles.COLLECTOR, roles.ADMIN].includes(profile?.role)
  );

  return (
    <div className={`app-shell ${showBottomDock ? "with-bottom-dock" : ""}`}>
      {showNavbar ? <Navbar /> : null}
      {showNavbar ? <IncomingTransferNotice /> : null}
      <AppUpdateNotice />
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
          path="/user/transactions"
          element={
            <ProtectedRoute allowedRoles={[roles.USER]}>
              <UserTransactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/settings"
          element={
            <ProtectedRoute allowedRoles={[roles.USER]}>
              <UserSettings />
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
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManageUsers />
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
        <Route
          path="/admin/settlements"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManageSettlements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leagues"
          element={
            <ProtectedRoute allowedRoles={[roles.ADMIN]}>
              <ManageLeagues />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showBottomDock ? <UserBottomDock /> : null}
    </div>
  );
}
