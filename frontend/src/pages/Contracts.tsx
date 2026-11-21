import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Contract, Group, Summary, useApi } from "../api";
import { Breadcrumbs, ContractList, ErrorBox, Loading } from "../components/Bits";
import { CountUp, MoneyBar } from "../components/viz";
import { procedureLabel } from "../format";

interface Page {
  total: number;
  amount: number;
  page: number;
  per_page: number;
  items: Contract[];
}

export default function Contracts() {
  const [params, setParams] = useSearchParams();
  const { data: cats } = useApi<Group[]>("/api/categories");
  const { data: summary } = useApi<Summary>("/api/summary");
  const qs = params.toString();
  const { data, error, loading } = useApi<Page>(`/api/contracts?per_page=30&${qs}`);
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  function set(key: string, value: string | null) {
    const p = new URLSearchParams(params);
    if (value && p.get(key) !== value) p.set(key, value);
    else p.delete(key);
    if (key !== "page") p.delete("page");
    setParams(p);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams(params);
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    p.delete("page");
    setParams(p);
  }
  const page = Number(params.get("page") ?? 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;
  const years = (summary?.by_year ?? []).map((y) => y.year).reverse();
  const active = (k: string, v: string) => params.get(k) === v;
  const anyFilter = [...params.keys()].length > 0;

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Contratos" }]} />
      <h1>Contratos</h1>

      <form className="bigsearch" onSubmit={submit} role="search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca una empresa, una escuela, un concierto…" aria-label="Buscar" />
        <button type="submit" className="btn">Buscar</button>
      </form>

      {cats && <MoneyBar groups={cats} active={params.get("category")} onPick={(g) => set("category", g.slug)} />}

      <div className="filter-rows">
        <div className="chips" aria-label="Tipo de gasto">
          {cats?.map((c) => (
            <button key={c.slug} className={`chip ${active("category", c.slug) ? "is-on" : ""}`} onClick={() => set("category", c.slug)}>{c.name}</button>
          ))}
        </div>
        <div className="chips" aria-label="Año y procedimiento">
          {years.map((y) => (
            <button key={y} className={`chip ${active("year", String(y)) ? "is-on" : ""}`} onClick={() => set("year", String(y))}>{y}</button>
          ))}
          <span className="chip-sep" />
          {["menor", "negociado", "emergencia", "abierto"].map((k) => (
            <button key={k} className={`chip ${active("procedure", k) ? "is-on" : ""}`} onClick={() => set("procedure", k)}>{procedureLabel[k]}</button>
          ))}
          <span className="chip-sep" />
          <button className={`chip chip-warn ${active("signals", "true") ? "is-on" : ""}`} onClick={() => set("signals", "true")}>Con señales</button>
          {anyFilter && <button className="btn-ghost" onClick={() => setParams(new URLSearchParams())}>Limpiar</button>}
        </div>
      </div>

      <section aria-live="polite">
        {data && (
          <div className="results-head">
            <p><strong>{data.total}</strong> contratos · <CountUp value={data.amount} /></p>
            <select value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value || null)} aria-label="Ordenar">
              <option value="">Más recientes</option>
              <option value="amount">Mayor importe</option>
              <option value="oldest">Más antiguos</option>
            </select>
          </div>
        )}
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {data && <ContractList key={qs} items={data.items} />}
        {data && pages > 1 && (
          <nav className="pager" aria-label="Páginas">
            <button className="btn-ghost" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>← Anterior</button>
            <span>{page} / {pages}</span>
            <button className="btn-ghost" disabled={page >= pages} onClick={() => set("page", String(page + 1))}>Siguiente →</button>
          </nav>
        )}
      </section>
    </div>
  );
}
