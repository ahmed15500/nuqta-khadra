import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

export default function UserSettings() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  useEffect(() => {
    setName(profile?.name || "");
  }, [profile?.name]);

  const canSaveName = useMemo(() => {
    const next = String(name || "").trim();
    const current = String(profile?.name || "").trim();
    return Boolean(next) && next !== current;
  }, [name, profile?.name]);

  const updateName = async (e) => {
    e.preventDefault();
    setNameMsg("");
    setNameErr("");

    const nextName = String(name || "").trim();
    if (!nextName) {
      setNameErr("الاسم مطلوب.");
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase.from("profiles").update({ name: nextName }).eq("id", profile.id);
      if (error) throw error;

      // Keep auth metadata in sync when available.
      await supabase.auth.updateUser({ data: { name: nextName } });

      await refreshProfile();
      setNameMsg("تم تحديث الاسم بنجاح.");
    } catch (err) {
      setNameErr(err?.message || "تعذر تحديث الاسم.");
    } finally {
      setSavingName(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordErr("");

    if (!password || password.length < 6) {
      setPasswordErr("كلمة السر يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordErr("تأكيد كلمة السر غير مطابق.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPassword("");
      setConfirmPassword("");
      setPasswordMsg("تم تغيير كلمة السر بنجاح.");
    } catch (err) {
      setPasswordErr(err?.message || "تعذر تغيير كلمة السر.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="page">
      <h1>إعدادات الحساب</h1>

      <form className="card" onSubmit={updateName} noValidate>
        <h2>تعديل الاسم</h2>
        <label>
          الاسم
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" required />
        </label>

        {nameMsg ? <p className="success">{nameMsg}</p> : null}
        {nameErr ? <p className="error">{nameErr}</p> : null}

        <button className="btn" type="submit" disabled={!canSaveName || savingName}>
          {savingName ? "جاري الحفظ..." : "حفظ الاسم"}
        </button>
      </form>

      <form className="card" onSubmit={updatePassword} noValidate>
        <h2>تغيير كلمة السر</h2>

        <label>
          كلمة السر الجديدة
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            minLength={6}
            required
          />
        </label>

        <label>
          تأكيد كلمة السر
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="********"
            minLength={6}
            required
          />
        </label>

        {passwordMsg ? <p className="success">{passwordMsg}</p> : null}
        {passwordErr ? <p className="error">{passwordErr}</p> : null}

        <button className="btn" type="submit" disabled={savingPassword}>
          {savingPassword ? "جاري التحديث..." : "تحديث كلمة السر"}
        </button>
      </form>
    </section>
  );
}

