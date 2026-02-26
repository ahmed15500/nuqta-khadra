import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { loading, session, profile, authError, syncAuthState } = useAuth();
  const shouldBlockAuthError = Boolean(authError && (!session || !profile));

  if (loading) return <p className="center">جاري التحميل...</p>;

  if (shouldBlockAuthError) {
    return (
      <div className="center">
        <p className="error">تعذر تحميل بيانات الحساب</p>
        <p className="muted">{authError}</p>
        <button className="btn" onClick={syncAuthState}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <p className="center">لا توجد بيانات مستخدم مرتبطة بهذا الحساب.</p>;
  if (profile.disabled) return <p className="error center">هذا الحساب غير مفعل.</p>;
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />;

  return children;
}
