// Shared working document passed between tabs (transcribe → review → export).
const KEY = "sawtuk-document";

export function loadDocument(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY) ?? "";
}

export function saveDocument(text: string) {
  localStorage.setItem(KEY, text);
}

// Arabic harakat, tanween, shadda, sukun, superscript alef, and Quranic marks
const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
export function stripDiacritics(text: string) {
  return text.replace(DIACRITICS_RE, "");
}
