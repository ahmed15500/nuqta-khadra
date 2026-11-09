// EcoWasteAI — classify-waste edge function
// Receives a base64 photo of a bag of waste and asks Gemini Vision to classify
// it into one of the app's waste types and estimate its weight.
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

  let payload: {
    image_base64?: string;
    mime_type?: string;
    waste_types?: string[];
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const imageBase64 = String(payload.image_base64 || "").replace(/^data:[^,]+,/, "");
  if (!imageBase64) {
    return json({ error: "missing_image" }, 400);
  }
  const mimeType = String(payload.mime_type || "image/jpeg");
  const knownTypes = Array.isArray(payload.waste_types) && payload.waste_types.length
    ? payload.waste_types.map((t) => String(t)).join("، ")
    : "بلاستيك، ورق وكرتون، معدن، زجاج، مخلفات عضوية، أخرى";

  const prompt = [
    "أنت مصنّف مخلفات لمنصة إعادة تدوير.",
    `أنواع المخلفات المعتمدة في المنصة: ${knownTypes}.`,
    "انظر إلى الصورة وحدّد نوع المخلفات الغالب فيها من الأنواع المعتمدة فقط،",
    "وقدّر وزن الكيس أو الكمية الظاهرة بالكيلوجرام تقديرًا تقريبيًا.",
    "أعد الرد بصيغة JSON فقط دون أي نص إضافي، وبالشكل التالي:",
    '{"waste_type_name": "<اسم النوع كما هو في القائمة>", "confidence": <رقم بين 0 و 1>, "estimated_weight_kg": <رقم>}',
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
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return json({ error: "ai_failed", detail: detail.slice(0, 300) });
    }

    const geminiJson = await geminiRes.json();
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = String(text).match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ error: "ai_failed", detail: "unparseable_response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return json({
      waste_type_name: String(parsed.waste_type_name || ""),
      confidence: Number(parsed.confidence ?? 0),
      estimated_weight_kg: Number(parsed.estimated_weight_kg ?? 0),
    });
  } catch (err) {
    return json({ error: "ai_failed", detail: String(err).slice(0, 300) });
  }
});
