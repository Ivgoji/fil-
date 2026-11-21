import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Signal, useApi } from "../api";
import { Breadcrumbs, ErrorBox, Loading, SignalCard } from "../components/Bits";
import { CountUp } from "../components/viz";
import { kindLabel } from "../format";

interface Resp {
  counts: Record<string, number>;
  items: Signal[];
}

const TABS = [
  { id: "gemelos", text: "Varios contratos menores con el mismo objeto, firmados casi a la vez." },
  { id: "limite", text: "Contratos menores a menos de un 7% del máximo legal." },
  { id: "recurrente", text: "El mismo servicio contratado como menor año tras año." },
] as const;

export default function Signals() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("tipo") ?? "gemelos";
  const { data, error, loading } = useApi<Resp>(`/api/signals?kind=${kind}`);
  const counts = data?.counts ?? {};

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Señales" }]} />
      <h1>Para mirar con lupa</h1>
      <p className="lead-muted">Patrones que suelen revisar los órganos de control. No son irregularidades.</p>

      <div className="signal-tabs" role="tablist">
        {TABS.map((t) => (
          <motion.button
            key={t.id}
            role="tab"
            aria-selected={kind === t.id}
            className={`signal-tab ${kind === t.id ? "is-on" : ""}`}
            onClick={() => setParams({ tipo: t.id })}
            whileHover={{ y: -3 }}
          >
            <CountUp value={counts[t.id] ?? 0} format={(n) => String(Math.round(n))} className="signal-tab-n" />
            <span className="signal-tab-label">{kindLabel[t.id]}</span>
            <span className="signal-tab-text">{t.text}</span>
          </motion.button>
        ))}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && data.items.length === 0 && <p className="status">No hay señales de este tipo.</p>}
      <div className="signal-grid">
        {data?.items.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
            <SignalCard s={s} defaultOpen={i === 0 && kind !== "limite"} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
