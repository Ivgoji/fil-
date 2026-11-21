import { Link, useParams } from "react-router-dom";
import { Contract, Signal, useApi } from "../api";
import { Breadcrumbs, ContractList, ErrorBox, Loading, SectionHead, SignalCard } from "../components/Bits";
import { CountUp, LimitGauge } from "../components/viz";
import { date, procedureLabel } from "../format";
import { displayName, displayText } from "../lib/text";

interface Detail {
  contract: Contract;
  signals: Signal[];
  same_supplier: Contract[];
  history: Contract[];
}

export default function ContractDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Detail>(`/api/contracts/${id}`);
  if (loading) return <div className="wrap page"><Loading /></div>;
  if (error || !data) return <div className="wrap page"><ErrorBox message={error ?? "Sin datos"} /></div>;
  const c = data.contract;

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { to: "/contratos", label: "Contratos" }, { label: `Expediente ${c.file || c.id}` }]} />
      <p className="kicker">{c.category}{c.event && <> · <Link to={`/eventos/${c.event_slug}`}>{c.event}</Link></>}</p>
      <h1 className="title-long">{displayText(c.description)}</h1>

      <div className="contract-hero">
        <div>
          <CountUp className="hero-big ink" value={c.amount} />
          <p className="contract-who">
            para <Link to={`/empresas/${c.supplier_key}`}>{displayName(c.supplier)}</Link> · {date(c.date)}
          </p>
          {c.limit && c.procedure_kind === "menor" && <LimitGauge amount={c.amount} limit={c.limit} />}
        </div>
        <dl className="facts">
          <div><dt>Procedimiento</dt><dd>{procedureLabel[c.procedure_kind] ?? c.procedure}</dd></div>
          <div><dt>Tipo</dt><dd>{c.contract_type}</dd></div>
          <div><dt>Contratante</dt><dd>{c.body}</dd></div>
          <div><dt>Expediente</dt><dd>{c.file || "—"}{c.lot && c.lot !== "1" ? ` · lote ${c.lot}` : ""}</dd></div>
        </dl>
      </div>

      {data.signals.length > 0 && (
        <section className="band-inline">
          <SectionHead title="Señales" />
          <div className="signal-grid">{data.signals.map((s) => <SignalCard key={s.id} s={s} defaultOpen />)}</div>
        </section>
      )}
      {data.history.length > 0 && (
        <section className="band-inline">
          <SectionHead title="Prórrogas y modificaciones" />
          <ContractList items={data.history} showSupplier={false} />
        </section>
      )}
      {data.same_supplier.length > 0 && (
        <section className="band-inline">
          <SectionHead title="Otros contratos de la empresa">
            <Link className="link-arrow" to={`/empresas/${c.supplier_key}`}>Ficha de la empresa</Link>
          </SectionHead>
          <ContractList items={data.same_supplier} showSupplier={false} limit={5} />
        </section>
      )}
    </div>
  );
}
