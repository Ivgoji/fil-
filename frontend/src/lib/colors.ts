/** Paleta: un único azul (#0000FF) en distintas intensidades, y naranja para señales. */
export const BLUE = "#0000FF";
export const WARN = "#FF5A1F";

const SHADES = ["#0000FF", "#2A2AFF", "#5252FF", "#7575FF", "#9898FF", "#B8B8FF", "#D3D3FF", "#E6E6FF"];

const ORDER = [
  "Obras y mantenimiento de edificios",
  "Software y tecnología",
  "Espectáculos y conciertos",
  "Producción de fiestas y ferias",
  "Servicios sociales y educativos",
  "Estudios, proyectos y asistencia técnica",
  "Mantenimiento urbano y zonas verdes",
  "Deportes",
  "Limpieza",
  "Energía y combustibles",
  "Seguros y servicios financieros",
  "Defensa y asesoría jurídica",
  "Patrocinios deportivos",
  "Comunicación y publicidad",
  "Equipamiento y suministros",
  "Servicios generales y personal",
  "Otros",
];

/** Color por posición en un ranking (el mayor, el azul más intenso). */
export function shade(i: number): string {
  return SHADES[Math.min(i, SHADES.length - 1)];
}

/** Color estable para una categoría, sin depender del orden en que llegue. */
export function categoryColor(name: string, rank?: number): string {
  if (rank != null) return shade(rank);
  const i = ORDER.indexOf(name);
  return shade(i < 0 ? SHADES.length - 1 : i % SHADES.length);
}

/** Texto blanco sobre los tonos intensos, azul oscuro sobre los claros. */
export function inkOn(color: string): string {
  const i = SHADES.indexOf(color);
  return i >= 0 && i <= 3 ? "#fff" : "#0A0B2E";
}
