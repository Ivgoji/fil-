import { useEffect, useState } from "react";

export interface Contract {
  id: number;
  body: string;
  file: string;
  procedure: string;
  procedure_kind: string;
  contract_type: string;
  status: string;
  is_award: boolean;
  year: number;
  date: string | null;
  amount: number;
  supplier: string;
  supplier_key: string;
  description: string;
  lot: string;
  category: string;
  event: string | null;
  event_slug: string | null;
  place: string | null;
  limit: number | null;
  near_limit: boolean;
  signal_ids: string[];
}

export interface Signal {
  id: string;
  kind: "gemelos" | "limite" | "recurrente";
  level: "alta" | "media" | "baja";
  title: string;
  explanation: string;
  total: number;
  limit: number | null;
  contracts: Contract[];
}

export interface Group {
  name: string;
  slug: string;
  total: number;
  count: number;
  years?: number[];
}

export interface SupplierRow {
  key: string;
  name: string;
  total: number;
  count: number;
  direct_count: number;
  flagged: number;
  first_date: string | null;
  last_date: string | null;
  category: string | null;
  activity: string | null;
  sector: string | null;
  founded: number | null;
  has_profile: boolean;
}

export interface SupplierGroup {
  key: string;
  name: string;
  total: number;
  count: number;
}

export interface YearRow {
  year: number;
  total: number;
  count?: number;
}

export interface Company {
  key: string;
  activity: string;
  sector: string;
  founded: number | null;
  hq: string | null;
  group: string | null;
  history: string[];
  sources: { label: string; url: string }[];
}

export interface CategoryDetail {
  name: string;
  slug: string;
  total: number;
  count: number;
  direct_count: number;
  by_year: YearRow[];
  suppliers: SupplierGroup[];
  places: Group[];
  contracts: Contract[];
}

export interface EventDetailData {
  name: string;
  slug: string;
  total: number;
  count: number;
  by_year: YearRow[];
  by_category: Group[];
  by_procedure: Group[];
  suppliers: SupplierGroup[];
  contracts: Contract[];
}

export interface SupplierDetailData {
  key: string;
  name: string;
  names: string[];
  total: number;
  count: number;
  direct_count: number;
  bodies: string[];
  by_year: YearRow[];
  by_category: Group[];
  repeated_amounts: { amount: number; times: number }[];
  first_date: string | null;
  last_date: string | null;
  places: Group[];
  events: Group[];
  profile: Company | null;
  contracts: Contract[];
  signals: Signal[];
}

export interface Meta {
  municipality: string;
  is_sample: boolean;
  updated: string;
  source: string;
  contracts: number;
}

export interface Summary {
  years: { from: number | null; to: number | null };
  totals: {
    awarded: number;
    awarded_count: number;
    direct: number;
    direct_count: number;
    minor: number;
    minor_count: number;
    near_limit: number;
    near_limit_count: number;
    twin_groups: number;
    twin_over_limit: number;
    suppliers: number;
  };
  by_category: Group[];
  by_category_direct: Group[];
  by_procedure: Group[];
  by_year: { year: number; total: number; count: number }[];
  events: Group[];
  top_suppliers: SupplierRow[];
  latest: Contract[];
  signals: Signal[];
}

export interface PlaceRow {
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lon: number | null;
  total: number;
  count: number;
  flagged: number;
}

/** true cuando la web se publica sin servidor: los datos salen de /data/*.json (ver `cargo run -- export`). */
export const STATIC = import.meta.env.VITE_STATIC === "1";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Error ${res.status} al cargar ${path}`);
  return res.json() as Promise<T>;
}

type StaticContract = Contract & { category_slug: string; body_slug: string; search: string };
let allContracts: Promise<StaticContract[]> | null = null;

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Réplica en el navegador del filtro de /api/contracts del servidor. */
async function staticContracts(params: URLSearchParams) {
  allContracts ??= fetchJSON<StaticContract[]>("/data/contracts.json");
  const all = await allContracts;
  const q = fold(params.get("q") ?? "").trim();
  const year = params.get("year");
  let v = all.filter(
    (c) =>
      (c.is_award || params.get("include_extensions") === "true") &&
      (!params.get("category") || c.category_slug === params.get("category")) &&
      (!params.get("procedure") || c.procedure_kind === params.get("procedure")) &&
      (!year || c.year === Number(year)) &&
      (!params.get("body") || c.body_slug === params.get("body")) &&
      (params.get("signals") !== "true" || c.signal_ids.length > 0) &&
      (!q || c.search.includes(q)),
  );
  const sort = params.get("sort");
  if (sort === "amount") v = [...v].sort((a, b) => b.amount - a.amount);
  if (sort === "oldest") v = [...v].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const per = Math.min(200, Math.max(1, Number(params.get("per_page") ?? 25)));
  const page = Math.max(1, Number(params.get("page") ?? 1));
  return {
    total: v.length,
    amount: Math.round(v.reduce((a, c) => a + c.amount, 0)),
    page,
    per_page: per,
    items: v.slice((page - 1) * per, page * per),
  };
}

export async function getJSON<T>(path: string): Promise<T> {
  if (!STATIC) return fetchJSON<T>(path);
  const [route, query = ""] = path.replace(/^\/api\//, "").split("?");
  const params = new URLSearchParams(query);
  if (route === "contracts") return (await staticContracts(params)) as T;
  if (route === "signals" && params.get("kind")) return fetchJSON<T>(`/data/signals/${params.get("kind")}.json`);
  return fetchJSON<T>(`/data/${route}.json`);
}

/** Carga datos de la API y vuelve a cargar cuando cambia la ruta. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getJSON<T>(path)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);
  return { data, error, loading };
}
