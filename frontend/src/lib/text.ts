/** Utilidades para mostrar nombres y descripciones del registro de forma legible. */

const SMALL = new Set(["de", "del", "la", "las", "los", "el", "els", "les", "y", "i", "en", "a", "al", "per", "e", "o"]);

const upperRatio = (s: string) => {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return 0;
  return letters.replace(/[^A-ZÀ-Þ]/g, "").length / letters.length;
};

function titleWord(w: string, first: boolean): string {
  if (!w) return w;
  // Siglas: T.E.C.S.A.L., (GISA), RCD… se quedan como están.
  if (/^[A-ZÀ-Þ](\.[A-ZÀ-Þ])+\.?,?$/.test(w) || /^\([A-ZÀ-Þ]{2,6}\)$/.test(w) || /^[B-DF-HJ-NP-TV-Z]{2,4}[.,]?$/.test(w)) return w;
  const lower = w.toLowerCase();
  // d'infraestructures → d'Infraestructures
  const ap = lower.match(/^([dl])['’](.+)$/);
  if (ap) return `${first ? ap[1].toUpperCase() : ap[1]}'${ap[2].charAt(0).toUpperCase()}${ap[2].slice(1)}`;
  if (!first && SMALL.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Nombre de empresa sin forma jurídica y, si viene en mayúsculas, en tipo título. */
export function displayName(name: string): string {
  let n = name
    .replace(/,?\s*(S\.?A\.?|S\.?L\.?U?\.?)\s*(\([^)]*\))$/i, " $2")
    .replace(/,?\s*sucursal en espa[ñn]a\.?$/i, "")
    .replace(/,?\s*(Sociedad Unipersonal|Unipersonal)\.?$/i, "")
    .replace(/,?\s*(S\.?L\.?U\.?|S\.?L\.?L\.?|S\.?L\.?P\.?|S\.?L\.?|S\.?A\.?U\.?|S\.?A\.?|S\.?C\.?C\.?L\.?|S\.?C\.?P\.?|SLU|SL|SA|AG)\.?$/i, "")
    .replace(/,?\s*(Sociedad Unipersonal|Unipersonal)\.?$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  if (upperRatio(n) > 0.6) n = n.split(/\s+/).map((w, i) => titleWord(w, i === 0)).join(" ");
  return n || name;
}

/** Descripción en mayúsculas → frase normal. */
export function displayText(text: string): string {
  if (upperRatio(text) <= 0.6) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
