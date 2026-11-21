import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Summary, SupplierRow, useApi } from "../api";
import { ErrorBox, Loading, SectionHead } from "../components/Bits";
import { CategoryList, EventExplorer, MapExplorer, SupplierRanking } from "../components/explorers";
import { CountUp, MoneyBar } from "../components/viz";
import { LimitRulers, RuleExplainer, TwinCases } from "../components/signals";

export default function Home() {
  const { data: s, error, loading } = useApi<Summary>("/api/summary");
  const { data: suppliers } = useApi<SupplierRow[]>("/api/suppliers");
  const [cat, setCat] = useState<string | null>(null);
  const explorerRef = useRef<HTMLElement>(null);

  if (loading) return <div className="wrap page"><Loading /></div>;
  if (error || !s) return <div className="wrap page"><ErrorBox message={error ?? "Sin datos"} /></div>;
  const t = s.totals;
  const period = s.years.from && s.years.to ? `${s.years.from}–${s.years.to}` : "";

  const pickCategory = (slug: string) => {
    setCat(slug);
    explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <motion.p className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Cornellà de Llobregat · {period}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            ¿A dónde va el dinero de Cornellà?
          </motion.h1>
          <div className="hero-figure">
            <CountUp value={t.awarded} />
            <span>adjudicados en {t.awarded_count} contratos a {t.suppliers} empresas</span>
          </div>
          <MoneyBar groups={s.by_category} active={cat} onPick={(g) => pickCategory(g.slug)} />
          <p className="hint">Pasa el ratón por la barra. Pulsa un tramo para abrirlo.</p>
          <div className="hero-stats">
            <Link to="/contratos?procedure=menor" className="stat">
              <CountUp value={t.direct_count} format={(n) => String(Math.round(n))} />
              <span>sin concurso abierto</span>
            </Link>
            <Link to="/senales?tipo=limite" className="stat">
              <CountUp value={t.near_limit_count} format={(n) => String(Math.round(n))} />
              <span>rozando el límite legal</span>
            </Link>
            <Link to="/senales" className="stat stat-warn">
              <CountUp value={t.twin_groups} format={(n) => String(Math.round(n))} />
              <span>grupos de contratos gemelos</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <SectionHead kicker="01" title="Dónde se gasta">
            <Link className="link-arrow" to="/mapa">Mapa completo</Link>
          </SectionHead>
          <MapExplorer />
        </div>
      </section>

      <section className="band band-soft" ref={explorerRef}>
        <div className="wrap">
          <SectionHead kicker="02" title="En qué se gasta">
            <span className="hint">Pulsa una fila para abrirla</span>
          </SectionHead>
          <CategoryList groups={s.by_category} initial={cat} />
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <SectionHead kicker="03" title="Quién cobra">
            <Link className="link-arrow" to="/empresas">Todas las empresas</Link>
          </SectionHead>
          {suppliers ? <SupplierRanking rows={suppliers} limit={8} /> : <Loading />}
        </div>
      </section>

      {s.events.length > 0 && (
        <section className="band band-soft">
          <div className="wrap">
            <SectionHead kicker="04" title="Lo que cuestan las fiestas">
              <Link className="link-arrow" to="/eventos">Todos los eventos</Link>
            </SectionHead>
            <EventExplorer events={s.events} />
          </div>
        </section>
      )}

      <section className="band band-lupa">
        <div className="wrap">
          <SectionHead kicker="05" title="Para mirar con lupa">
            <Link className="link-arrow" to="/senales">Todas las señales</Link>
          </SectionHead>
          <RuleExplainer />
          <h3 className="lupa-sub">La regla, contrato a contrato</h3>
          <p className="lupa-lead">Cada punto es un contrato menor. Cuanto más a la derecha, más cerca del máximo que permite la ley sin concurso.</p>
          <LimitRulers />
          <h3 className="lupa-sub">Los casos</h3>
          <p className="lupa-lead">Contratos casi iguales firmados a la vez. Sumados, así quedan frente al límite.</p>
          <TwinCases />
        </div>
      </section>
    </>
  );
}
