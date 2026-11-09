// EcoWasteAI — ask-data edge function
// Answers an admin's Arabic question about the platform using ONLY the stats
// context the app computed from Supabase (no invented numbers).
// Requires the GEMINI_API_KEY secret:  supabase secrets set GEMINI_API_KEY=...
// Until the key exists, it answers { error: "not_configured" } with HTTP 200 so
// the app can show its "AI will be activated soon" notice.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = [
  "أنت مساعد تحليلات لمنصة EcoWasteAI لإدارة إعادة التدوير بنظام النقاط.",
  "ستصلك إحصائيات حقيقية من قاعدة بيانات المنصة بصيغة JSON، ثم سؤال من مسؤول الإدارة.",
  "قواعد صارمة:",
  "1) أجب بالعربية البسيطة الواضحة فقط.",
  "2) استخدم الأرقام الموجودة في الإحصائيات المرفقة فقط، ولا تخترع أي رقم أو معلومة غير موجودة فيها.",
  "3) إذا لم تكن الإجابة موجودة في الإحصائيات، قل بوضوح إن البيانات المتاحة لا تكفي للإجابة.",
  "4) كن موجزًا ومباشرًا، واستخدم أسطرًا قصيرة أو نقاطًا عند الحاجة.",
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ error: "not_configured" });
  }

  let payload: { question?: string; stats?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const question = String(payload.question || "").trim();
  if (!question) {
    return json({ error: "missing_question" }, 400);
  }
  const stats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};

  const userText = [
    "إحصائيات المنصة الحالية (JSON):",
    JSON.stringify(stats, null, 2),
    "",
    `سؤال الإدارة: ${question}`,
  ].join("\n");

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.3 },
        }),
      },
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return json({ error: "ai_failed", detail: detail.slice(0, 300) });
    }

    const geminiJson = await geminiRes.json();
    const answer = String(geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (!answer) {
      return json({ error: "ai_failed", detail: "empty_answer" });
    }
    return json({ answer });
  } catch (err) {
    return json({ error: "ai_failed", detail: String(err).slice(0, 300) });
  }
});
