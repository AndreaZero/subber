import type { UiLang } from "./i18n";

export type LangCode = string;

export const DEFAULT_SPOKEN_LANG = "auto";
export const DEFAULT_OUTPUT_LANG = "it";

/** Lingue Whisper. Default UI: rilevamento automatico. */
export const SPOKEN_LANGUAGES: { id: LangCode; label: string }[] = [
  { id: "auto", label: "Rileva automaticamente" },
  { id: "it", label: "Italiano" },
  { id: "fr", label: "Francese" },
  { id: "en", label: "Inglese" },
  { id: "es", label: "Spagnolo" },
  { id: "de", label: "Tedesco" },
  { id: "pt", label: "Portoghese" },
  { id: "nl", label: "Olandese" },
  { id: "pl", label: "Polacco" },
  { id: "ru", label: "Russo" },
  { id: "uk", label: "Ucraino" },
  { id: "ro", label: "Rumeno" },
  { id: "el", label: "Greco" },
  { id: "cs", label: "Ceco" },
  { id: "hu", label: "Ungherese" },
  { id: "sv", label: "Svedese" },
  { id: "da", label: "Danese" },
  { id: "fi", label: "Finlandese" },
  { id: "no", label: "Norvegese" },
  { id: "ar", label: "Arabo" },
  { id: "he", label: "Ebraico" },
  { id: "tr", label: "Turco" },
  { id: "zh", label: "Cinese" },
  { id: "ja", label: "Giapponese" },
  { id: "ko", label: "Coreano" },
  { id: "hi", label: "Hindi" },
  { id: "bn", label: "Bengalese" },
  { id: "ur", label: "Urdu" },
  { id: "fa", label: "Persiano" },
  { id: "th", label: "Thai" },
  { id: "vi", label: "Vietnamita" },
  { id: "id", label: "Indonesiano" },
  { id: "ms", label: "Malese" },
  { id: "ta", label: "Tamil" },
  { id: "te", label: "Telugu" },
  { id: "af", label: "Afrikaans" },
  { id: "am", label: "Amarico" },
  { id: "as", label: "Assamese" },
  { id: "az", label: "Azero" },
  { id: "ba", label: "Baschiro" },
  { id: "be", label: "Bielorusso" },
  { id: "bg", label: "Bulgaro" },
  { id: "bo", label: "Tibetano" },
  { id: "br", label: "Bretone" },
  { id: "bs", label: "Bosniaco" },
  { id: "ca", label: "Catalano" },
  { id: "cy", label: "Gallese" },
  { id: "et", label: "Estone" },
  { id: "eu", label: "Basco" },
  { id: "fo", label: "Faroese" },
  { id: "gl", label: "Galiziano" },
  { id: "gu", label: "Gujarati" },
  { id: "ha", label: "Hausa" },
  { id: "haw", label: "Hawaiano" },
  { id: "hr", label: "Croato" },
  { id: "ht", label: "Creolo haitiano" },
  { id: "hy", label: "Armeno" },
  { id: "is", label: "Islandese" },
  { id: "jw", label: "Giavanese" },
  { id: "ka", label: "Georgiano" },
  { id: "kk", label: "Kazako" },
  { id: "km", label: "Khmer" },
  { id: "kn", label: "Kannada" },
  { id: "la", label: "Latino" },
  { id: "lb", label: "Lussemburghese" },
  { id: "ln", label: "Lingala" },
  { id: "lo", label: "Lao" },
  { id: "lt", label: "Lituano" },
  { id: "lv", label: "Lettone" },
  { id: "mg", label: "Malgascio" },
  { id: "mi", label: "Maori" },
  { id: "mk", label: "Macedone" },
  { id: "ml", label: "Malayalam" },
  { id: "mn", label: "Mongolo" },
  { id: "mr", label: "Marathi" },
  { id: "mt", label: "Maltese" },
  { id: "my", label: "Birmano" },
  { id: "ne", label: "Nepalese" },
  { id: "nn", label: "Norvegese nynorsk" },
  { id: "oc", label: "Occitano" },
  { id: "pa", label: "Punjabi" },
  { id: "ps", label: "Pashto" },
  { id: "sa", label: "Sanscrito" },
  { id: "sd", label: "Sindhi" },
  { id: "si", label: "Singalese" },
  { id: "sk", label: "Slovacco" },
  { id: "sl", label: "Sloveno" },
  { id: "sn", label: "Shona" },
  { id: "so", label: "Somalo" },
  { id: "sq", label: "Albanese" },
  { id: "sr", label: "Serbo" },
  { id: "su", label: "Sundanese" },
  { id: "sw", label: "Swahili" },
  { id: "tg", label: "Tagico" },
  { id: "tk", label: "Turkmeno" },
  { id: "tl", label: "Filippino" },
  { id: "tt", label: "Tataro" },
  { id: "uz", label: "Uzbeko" },
  { id: "yi", label: "Yiddish" },
  { id: "yo", label: "Yoruba" },
  { id: "yue", label: "Cantonese" },
];

export const OUTPUT_LANGUAGES: { id: LangCode; label: string }[] = SPOKEN_LANGUAGES.filter(
  (lang) => lang.id !== "auto",
);

export function languageName(code: string, lang: UiLang): string {
  const id = (code || "").trim().toLowerCase();
  if (!id || id === "auto" || id === "und") {
    return lang === "it" ? "Rileva automaticamente" : "Detect automatically";
  }
  try {
    const name = new Intl.DisplayNames([lang], { type: "language" }).of(id.split("-")[0]);
    if (name) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    // ignore
  }
  return id.toUpperCase();
}
