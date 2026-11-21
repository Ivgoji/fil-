import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EventDetailData, useApi } from "../api";
import { Breadcrumbs, ContractList, ErrorBox, Loading, Reveal, SectionHead } from "../components/Bits";
import { CountUp, Donut, HBars, Timeline, YearColumns } from "../components/viz";
import { displayName } from "../lib/text";

export default function EventDetail() {
  const { slug } = useParams();
  const { data: d, error, loading } = useApi<EventDetailData>(`/api/events/${slug}`);
  const [cat, setCat] = useState<string | null>(null);
  const nav = useNavigate();
  const list = useMemo(() => {
    if (!d) return [];
    const name = d.by_category.find((g) => g.slug === cat)?.name;
    return cat ? d.contracts.filter((c) => c.category === name) : d.contracts;
  }, [d, cat]);
  if (loading) return <div className="wrap page"><Loading /></div>;
  if (error || !d) return <div className="wrap page"><ErrorBox message={error ?? "Sin datos"} /></div>;

  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { to: "/eventos", label: "Eventos" }, { label: d.name }]} />
      <p className="kicker">Evento</p>
      <h1>{d.name}</h1>
      <div className="headline-figure">
        <CountUp value={d.total} />
        <span>{d.count} contratos · {d.suppliers.length} empresas</span>
      </div>

      <div className="two-col">
        <Reveal>
          <SectionHead title="En qué se gasta" />
          <Donut groups={d.by_category} active={cat} onPick={(g) => setCat(g?.slug ?? null)} size={260} />
        </Reveal>
        <Reveal delay={0.1}>
          <SectionHead title="Quién cobra" />
          <HBars rows={d.suppliers.map((s) => ({ id: s.key, label: displayName(s.name), value: s.total }))} onPick={(k) => nav(`/empresas/${k}`)} />
          {d.by_year.length > 1 && (
            <>
              <h4>Por edición</h4>
              <YearColumns rows={d.by_year} height={120} />
            </>
          )}
        </Reveal>
      </div>

      <section className="band-inline">
        <SectionHead title="Cuándo se contrató" />
        <Timeline contracts={d.contracts} onPick={(c) => nav(`/contratos/${c.id}`)} />
      </section>

      <section className="band-inline">
        <SectionHead title={cat ? `${list.length} contratos de ${d.by_category.find((g) => g.slug === cat)?.name}` : "Todos los contratos"} />
        <ContractList items={list} limit={10} />
      </section>
    </div>
  );
}
