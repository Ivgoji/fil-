const eur = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);

export function euros(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${eur.format(Math.round(n))} €`;
}

/** 7.800.819 € → «7,8 millones». */
export function eurosShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("es-ES")} mil €`;
  return euros(n);
}

export function millions(n: number): string {
  return (n / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function date(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${months[m - 1]} ${y}`;
}

export const procedureLabel: Record<string, string> = {
  menor: "Contrato menor",
  negociado: "Negociado sin publicidad",
  emergencia: "Emergencia",
  abierto: "Abierto",
  acuerdo_marco: "Acuerdo marco",
  otros: "Otros",
};

export const levelLabel: Record<string, string> = {
  alta: "Revisar con prioridad",
  media: "A revisar",
  baja: "Patrón",
};

export const kindLabel: Record<string, string> = {
  gemelos: "Contratos gemelos",
  limite: "Rozando el límite",
  recurrente: "Servicio recurrente",
};
