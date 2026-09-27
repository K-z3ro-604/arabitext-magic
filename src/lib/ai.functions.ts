import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLicense, getOpenAIKey } from "./license.server";

async function openaiError(res: Response) {
  const body = await res.text();
  console.error(`OpenAI request failed [${res.status}]: ${body}`);
  let msg = body;
  try { msg = JSON.parse(body).error?.message ?? body; } catch { /* keep raw */ }
  return new Error(`خطأ من OpenAI (${res.status}): ${msg.slice(0, 200)}`);
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d) => {
    if (!(d instanceof FormData)) throw new Error("بيانات غير صالحة");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("لم يُرسل ملف");
    if (file.size > 25 * 1024 * 1024) throw new Error("الحد الأقصى لحجم الملف ٢٥ م.ب");
    return file;
  })
  .handler(async ({ data: file }) => {
    await requireLicense();
    const key = await getOpenAIKey();
    const fd = new FormData();
    fd.append("file", file, file.name || "audio.mp3");
    fd.append("model", "whisper-1");
    fd.append("language", "ar");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (!res.ok) throw await openaiError(res);
    const json = (await res.json()) as { text: string };
    return { text: json.text };
  });

const PROMPTS = {
  full: "أنت مُشكِّل لغوي خبير في العربية الفصحى. أضف التشكيل الكامل (الحركات والشدّة والتنوين والسكون) على كل حرف من النص التالي بدقة نحوية وصرفية. لا تغيّر أي كلمة ولا ترتيبها ولا علامات الترقيم. أعد النص المُشكَّل فقط دون أي شرح.",
  endings: "أنت مُعرِب خبير في العربية الفصحى. أضف علامة الإعراب أو البناء على الحرف الأخير من كل كلمة فقط (تشكيل أواخر الكلمات) وفق موقعها النحوي، واترك بقية الحروف دون تشكيل. لا تغيّر أي كلمة ولا ترتيبها ولا علامات الترقيم. أعد النص فقط دون أي شرح.",
  grammar: "أنت مدقق لغوي للعربية الفصحى. صحّح الأخطاء الإملائية والنحوية (الهمزات، التاء المربوطة، الألف المقصورة، الإعراب الظاهر) مع الحفاظ على المعنى والأسلوب. لا تضف تشكيلاً. أعد النص المصحّح فقط دون أي شرح.",
} as const;

export const processArabicText = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(20000), mode: z.enum(["full", "endings", "grammar"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireLicense();
    const key = await getOpenAIKey();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          { role: "system", content: PROMPTS[data.mode] },
          { role: "user", content: data.text },
        ],
      }),
    });
    if (!res.ok) throw await openaiError(res);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return { text: json.choices[0]?.message.content?.trim() ?? "" };
  });
