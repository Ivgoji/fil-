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

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Error ${res.status} al cargar ${path}`);
  return res.json() as Promise<T>;
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
