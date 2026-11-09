import { useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";

const STORE_ROLES = ["collector_store", "partner_store"];
const AI_NOTICE = "ميزة الذكاء الاصطناعي ستُفعَّل قريبًا عند إضافة مفتاح Gemini";
const WEEKLY_REPORT_QUESTION = "اكتب تقريرًا أسبوعيًا موجزًا عن أداء المنصة";

async function safeLoad(promise) {
  try {
    const { data, error } = await promise;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function asNumber(value) {
  return Number(value || 0);
}

// Build a compact, Arabic-labelled stats context from live Supabase data.
// This object is the ONLY source of numbers the AI is allowed to use.
async function computeStats() {
  const [profiles, wasteTypes, wasteRows, transferRows, settlementRows] = await Promise.all([
    safeLoad(supabase.from("profiles").select("id,name,role,points,store_name,disabled")),
    safeLoad(supabase.from("waste_types").select("id,name")),
    safeLoad(supabase.from("waste_transactions").select("id,collector_store_id,waste_type_id,weight_kg,points_awarded,created_at")),
    safeLoad(supabase.from("point_transfers").select("id,transfer_type,points,created_at")),
    safeLoad(supabase.from("point_settlements").select("id,cash_amount,points_settled,created_at"))
  ]);

  const customers = profiles.filter((p) => p.role === "user");
  const collectors = profiles.filter((p) => p.role === "collector_store");
  const partners = profiles.filter((p) => p.role === "partner_store");
  const shops = profiles.filter((p) => STORE_ROLES.includes(p.role));

  const typeById = new Map(wasteTypes.map((t) => [t.id, t.name]));
  const perTypeKg = {};
  wasteRows.forEach((row) => {
    const name = typeById.get(row.waste_type_id) || "غير معروف";
    perTypeKg[name] = Number(((perTypeKg[name] || 0) + asNumber(row.weight_kg)).toFixed(1));
  });

  const storeAgg = new Map();
  wasteRows.forEach((row) => {
    if (!row.collector_store_id) return;
    const entry = storeAgg.get(row.collector_store_id) || { ops: 0, kg: 0 };
    entry.ops += 1;
    entry.kg += asNumber(row.weight_kg);
    storeAgg.set(row.collector_store_id, entry);
  });
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const topStores = [...storeAgg.entries()]
    .map(([storeId, agg]) => {
      const store = profileById.get(storeId);
      return {
        "المحل": store?.store_name || store?.name || "محل",
        "عمليات الجمع": agg.ops,
        "الوزن (كجم)": Number(agg.kg.toFixed(1))
      };
    })
    .sort((a, b) => b["عمليات الجمع"] - a["عمليات الجمع"])
    .slice(0, 5);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lastWeekKg = wasteRows
    .filter((row) => new Date(row.created_at).getTime() >= sevenDaysAgo)
    .reduce((sum, row) => sum + asNumber(row.weight_kg), 0);

  return {
    "إجمالي العملاء": customers.length,
    "محلات التجميع": collectors.length,
    "المحلات الشريكة": partners.length,
    "المحلات غير المفعلة": shops.filter((s) => s.disabled).length,
    "عدد عمليات الجمع الكلي": wasteRows.length,
    "إجمالي المخلفات المجمعة (كجم)": Number(wasteRows.reduce((s, r) => s + asNumber(r.weight_kg), 0).toFixed(1)),
    "المخلفات المجمعة آخر 7 أيام (كجم)": Number(lastWeekKg.toFixed(1)),
    "إجمالي النقاط الممنوحة": wasteRows.reduce((s, r) => s + asNumber(r.points_awarded), 0),
    "إجمالي أرصدة نقاط العملاء الحالية": customers.reduce((s, r) => s + asNumber(r.points), 0),
    "إجمالي النقاط المستبدلة عند المحلات": transferRows
      .filter((r) => r.transfer_type === "user_to_store")
      .reduce((s, r) => s + asNumber(r.points), 0),
    "إجمالي التسويات النقدية المدفوعة (ج.م)": Number(settlementRows.reduce((s, r) => s + asNumber(r.cash_amount), 0).toFixed(2)),
    "عدد عمليات التسوية": settlementRows.length,
    "المخلفات حسب النوع (كجم)": perTypeKg,
    "أفضل محلات التجميع": topStores
  };
}

export default function AskData() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    computeStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statChips = useMemo(() => {
    if (!stats) return [];
    return [
      `العملاء: ${stats["إجمالي العملاء"]}`,
      `عمليات الجمع: ${stats["عدد عمليات الجمع الكلي"]}`,
      `المخلفات: ${stats["إجمالي المخلفات المجمعة (كجم)"]} كجم`,
      `النقاط الممنوحة: ${stats["إجمالي النقاط الممنوحة"]}`,
      `التسويات: ${stats["إجمالي التسويات النقدية المدفوعة (ج.م)"]} ج.م`
    ];
  }, [stats]);

  const ask = async (rawQuestion) => {
    const q = String(rawQuestion || "").trim();
    if (!q) {
      setError("اكتب سؤالك أولاً.");
      return;
    }
    if (!stats) {
      setError("بيانات المنصة غير متاحة حاليًا، حاول مرة أخرى.");
      return;
    }

    setAsking(true);
    setError("");
    setNotice("");
    setAnswer("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ask-data", {
        body: { question: q, stats }
      });

      if (invokeError) throw invokeError;

      if (data?.error === "not_configured") {
        setNotice(AI_NOTICE);
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.answer) throw new Error("empty_answer");

      setAnswer(String(data.answer));
    } catch {
      // Function not deployed yet, or Gemini key not set: same activation notice.
      setNotice(AI_NOTICE);
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="page">
      <h1>
        <Sparkles size={22} /> اسأل بياناتك
      </h1>
      <p className="muted">
        اسأل عن أداء المنصة بالعربية، وسيجيب الذكاء الاصطناعي اعتمادًا فقط على الأرقام الحقيقية التالية من قاعدة البيانات.
      </p>

      <div className="card">
        <h3>ملخص البيانات المستخدمة</h3>
        {statsLoading ? <p className="muted">جاري تجهيز الإحصائيات...</p> : null}
        {!statsLoading && stats ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {statChips.map((chip) => (
              <span
                key={chip}
                style={{
                  background: "var(--mint-100)",
                  border: "1px solid rgba(19,92,79,.15)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
        {!statsLoading && !stats ? <p className="muted">تعذر تحميل الإحصائيات حاليًا.</p> : null}
      </div>

      <div className="card">
        <label>
          سؤالك
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="مثال: ما أكثر نوع مخلفات تم جمعه؟ وأي محل هو الأنشط؟"
            rows={3}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="btn" onClick={() => ask(question)} disabled={asking || statsLoading}>
            <Send size={16} /> {asking ? "جاري التفكير..." : "اسأل"}
          </button>
          <button className="btn btn-outline" onClick={() => ask(WEEKLY_REPORT_QUESTION)} disabled={asking || statsLoading}>
            <FileText size={16} /> تقرير الأسبوع
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {notice ? (
          <p className="muted" style={{ background: "var(--gold-100)", borderRadius: 12, padding: "10px 14px", marginTop: 12 }}>
            {notice}
          </p>
        ) : null}
      </div>

      {answer ? (
        <div className="card">
          <h3>الإجابة</h3>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{answer}</div>
        </div>
      ) : null}
    </section>
  );
}
