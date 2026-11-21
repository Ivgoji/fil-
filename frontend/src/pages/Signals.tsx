import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { Signal, useApi } from "../api";
import { Breadcrumbs, ContractList, ErrorBox, Loading, SignalCard } from "../components/Bits";
import { LimitRulers, RuleBanner, TwinCase } from "../components/signals";

interface Resp {
  counts: Record<string, number>;
  items: Signal[];
}

const TABS = [
  {
    id: "gemelos",
    label: "Contratos gemelos",
    title: "El mismo trabajo, en varios contratos",
    text: "Contratos menores con un objeto casi idéntico firmados con pocos días de diferencia. Sumados, así quedan frente al límite.",
  },
  {
    id: "limite",
    label: "Rozando el límite",
    title: "Importes pegados al máximo",
    text: "Contratos menores a menos de un 7% del límite. Uno suelto no dice nada; muchos juntos, sí.",
  },
  {
    id: "recurrente",
    label: "Servicio recurrente",
    title: "El mismo servicio, año tras año",
    text: "Una misma empresa que recibe cada año un contrato menor para el mismo servicio. Lo periódico suele requerir concurso.",
  },
] as const;

export default function Signals() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("tipo") ?? "gemelos";
  const { data, error, loading } = useApi<Resp>(`/api/signals?kind=${kind}`);
  const counts = data?.counts ?? {};
  const tab = TABS.find((t) => t.id === kind) ?? TABS[0];

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Señales" }]} />
      <h1>Para mirar con lupa</h1>
      <p className="lead-muted">Patrones que suelen revisar los órganos de control. Señalan dónde mirar, no irregularidades.</p>

      <RuleBanner />

      <div className="seg-tabs" role="tablist" aria-label="Tipo de señal">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={kind === t.id} className={kind === t.id ? "is-on" : ""} onClick={() => setParams({ tipo: t.id })}>
            {kind === t.id && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
            <span className="seg-label">{t.label}</span>
            <span className="seg-count">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <motion.header key={tab.id} className="seg-head" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h2>{tab.title}</h2>
        <p>{tab.text}</p>
      </motion.header>

      {loading && <Loading />}
      {error && <ErrorBox message={error} />}

      {data && data.items.length === 0 && (
        <div className="empty-state">
          <strong>Ningún caso en estos datos</strong>
          <p>
            Fil busca la misma empresa con contratos menores de objeto parecido separados por unos 12 meses (sin contar espectáculos). En los
            contratos cargados no aparece ninguno.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && kind === "gemelos" && (
        <div className="twins">{data.items.map((s) => <TwinCase key={s.id} s={s} />)}</div>
      )}

      {data && data.items.length > 0 && kind === "limite" && (
        <>
          <LimitRulers />
          <h3 className="lupa-sub">Los {data.items.length} contratos rozando el límite</h3>
          <ContractList items={data.items.flatMap((s) => s.contracts)} limit={10} />
        </>
      )}

      {data && data.items.length > 0 && kind === "recurrente" && (
        <div className="signal-grid">
          {data.items.map((s, i) => <SignalCard key={s.id} s={s} defaultOpen={i === 0} />)}
        </div>
      )}
    </div>
  );
}
