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

const PRESERVE =
  "حافظ حفاظاً تاماً على كل علامات الترقيم الموجودة (، . ؛ : ؟ ! « » \" ...) وعلى الأقواس القرآنية ﴿ ﴾ ومواضعها كما هي، ولا تحذفها ولا تنقلها ولا تستبدلها.";

const QURAN =
  "تعرّف على أي آية أو جزء من آية قرآنية في النص، وصحّح رسمها إن لزم وفق المصحف، وضعها بين القوسين القرآنيين ﴿ ﴾ (مثال: قال تعالى: ﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾). لا تضع ﴿ ﴾ حول ما ليس قرآناً، ولا تكرر الأقواس إن كانت موجودة.";

const PUNCTUATE =
  "أدرج علامات الترقيم العربية الصحيحة بحسب السياق وتدفّق الكلام: النقطة (.) في نهاية الجمل التامة، والفاصلة (،) بين الجمل المتصلة والمعطوفات، والفاصلة المنقوطة (؛) للتعليل، والنقطتين (:) قبل القول والتعداد، وعلامة الاستفهام (؟) للأسئلة، وعلامة التعجب (!) للتعجب، وعلامات التنصيص « » حول الأقوال المنقولة والأحاديث. استخدم الرموز العربية (، ؛ ؟) لا اللاتينية.";

const PROMPTS = {
  punctuate: `أنت محرّر لغوي خبير بالعربية. النص التالي تفريغ آلي لكلام منطوق. ${PUNCTUATE} ${QURAN} لا تغيّر الكلمات ولا ترتيبها ولا تحذف شيئاً، ولا تضف تشكيلاً إلا داخل الآيات القرآنية. قسّم النص إلى فقرات عند تغيّر الفكرة. أعد النص فقط دون أي شرح.`,
  full: `أنت مُشكِّل لغوي خبير في العربية الفصحى. أضف التشكيل الكامل (الحركات والشدّة والتنوين والسكون) على كل حرف من النص التالي بدقة نحوية وصرفية. النص قد يكون مُدقّقاً نحوياً وإملائياً مسبقاً: لا تغيّر أي حرف أو كلمة أو همزة أو ترتيب، وأضف التشكيل فقط. ${PRESERVE} شكّل ما بين ﴿ ﴾ وفق ضبط المصحف. إن وُجد تشكيل سابق صحيح فأبقِه وأكمل الناقص. أعد النص المُشكَّل فقط دون أي شرح.`,
  endings: `أنت مُعرِب خبير في العربية الفصحى. أضف علامة الإعراب أو البناء على الحرف الأخير من كل كلمة وفق موقعها النحوي. لا تغيّر أي حرف أو كلمة أو همزة أو ترتيب، ولا تحذف أي تشكيل موجود مسبقاً داخل الكلمات. ${PRESERVE} أعد النص فقط دون أي شرح.`,
  grammar: `أنت مدقق لغوي للعربية الفصحى. صحّح الأخطاء الإملائية والنحوية (الهمزات، التاء المربوطة، الألف المقصورة، الإعراب الظاهر) مع الحفاظ على المعنى والأسلوب. ${PUNCTUATE} أبقِ علامات الترقيم الصحيحة الموجودة وأكمل الناقص فقط. ${QURAN} مهم جداً: حافظ على كل التشكيل (الحركات والشدّة والتنوين والسكون) الموجود في النص كما هو؛ لا تحذفه ولا تضف تشكيلاً جديداً، إلا إذا صحّحت كلمة مُشكَّلة فأعد تشكيلها تشكيلاً صحيحاً متسقاً مع التصحيح. أعد النص المصحّح فقط دون أي شرح.`,
} as const;

async function chat(key: string, system: string, text: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw await openaiError(res);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message.content?.trim() ?? "";
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
    const raw = json.text?.trim() ?? "";
    if (!raw) return { text: "" };
    // Post-process: punctuation + Quranic brackets. Fall back to raw text on failure.
    try {
      const punctuated = await chat(key, PROMPTS.punctuate, raw);
      return { text: punctuated || raw };
    } catch (e) {
      console.error("Punctuation pass failed", e);
      return { text: raw };
    }
  });

export const processArabicText = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(20000), mode: z.enum(["full", "endings", "grammar"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireLicense();
    const key = await getOpenAIKey();
    return { text: await chat(key, PROMPTS[data.mode], data.text) };
  });
