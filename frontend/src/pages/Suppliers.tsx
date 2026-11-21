import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { SupplierRow, useApi } from "../api";
import { Breadcrumbs, ErrorBox, Loading, Reveal } from "../components/Bits";
import { shortName, SupplierRanking } from "../components/explorers";
import { eurosShort } from "../format";

export default function Suppliers() {
  const { data, error, loading } = useApi<SupplierRow[]>("/api/suppliers");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [shown, setShown] = useState(24);
  const rows = data ?? [];
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];
  const list = rows.filter((r) => (!cat || r.category === cat) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Empresas" }]} />
      <h1>Quién cobra</h1>
      <p className="lead-muted">{rows.length} empresas. Pulsa una para ver su ficha.</p>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && <Reveal><SupplierRanking rows={data} limit={10} /></Reveal>}
      <h2 className="subhead">Todas</h2>

      <div className="filter-rows">
        <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(24); }} placeholder="Filtrar por nombre" aria-label="Filtrar por nombre" />
        <div className="chips">
          <button className={`chip ${!cat ? "is-on" : ""}`} onClick={() => setCat(null)}>Todas</button>
          {cats.map((c) => (
            <button key={c} className={`chip ${cat === c ? "is-on" : ""}`} onClick={() => setCat(cat === c ? null : c)}>{c}</button>
          ))}
        </div>
      </div>

      <motion.div layout className="company-grid">
        {list.slice(0, shown).map((r, i) => (
          <motion.div key={r.key} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
            <Link to={`/empresas/${r.key}`} className="company-card">
              <span className="company-top">
                <span className="company-sector">{r.sector ?? r.category ?? "—"}</span>
                {r.flagged > 0 && <span className="dot-warn" title="Con señales" />}
              </span>
              <span className="company-name">{shortName(r.name)}</span>
              {r.activity && <span className="company-activity">{r.activity}</span>}
              <span className="company-figure">{eurosShort(r.total)}</span>
              <span className="company-meter"><span style={{ width: `${(r.total / max) * 100}%` }} /></span>
              <span className="company-meta">
                {r.count} {r.count === 1 ? "contrato" : "contratos"}
                {r.first_date && ` · desde ${r.first_date.slice(0, 4)}`}
                {r.has_profile && <b className="badge">Ficha</b>}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
      {list.length > shown && (
        <button className="btn-ghost more" onClick={() => setShown(shown + 48)}>
          Ver más ({list.length - shown} restantes)
        </button>
      )}
    </div>
  );
}
