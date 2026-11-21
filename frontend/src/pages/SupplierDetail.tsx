import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Contract, SupplierDetailData, useApi } from "../api";
import { Breadcrumbs, ContractList, ErrorBox, Loading, Reveal, SectionHead, SignalCard } from "../components/Bits";
import { shortName } from "../components/explorers";
import { CountUp, Donut, LimitGauge, Timeline, YearColumns } from "../components/viz";
import { date, euros, eurosShort, procedureLabel } from "../format";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthYear = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`;

export default function SupplierDetail() {
  const { key } = useParams();
  const { data: d, error, loading } = useApi<SupplierDetailData>(`/api/suppliers/${key}`);
  const [pick, setPick] = useState<Contract | null>(null);
  if (loading) return <div className="wrap page"><Loading /></div>;
  if (error || !d) return <div className="wrap page"><ErrorBox message={error ?? "Sin datos"} /></div>;
  const p = d.profile;
  const awards = d.contracts.filter((c) => c.is_award);
  const pattern = d.signals.filter((s) => s.kind !== "limite");
  const projects = [...awards].sort((a, b) => b.amount - a.amount).slice(0, 6);

  return (
    <>
      <section className="company-hero">
        <div className="wrap">
          <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { to: "/empresas", label: "Empresas" }, { label: shortName(d.name) }]} />
          <div className="company-hero-grid">
            <div>
              <motion.p className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{p?.sector ?? d.by_category[0]?.name ?? "Empresa adjudicataria"}</motion.p>
              <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>{shortName(d.name)}</motion.h1>
              {p?.activity && <p className="company-hero-activity">{p.activity}</p>}
              <div className="chips chips-light">
                {p?.founded && <span className="chip">Fundada en {p.founded}</span>}
                {p?.hq && <span className="chip">{p.hq}</span>}
                {p?.group && <span className="chip">{p.group}</span>}
                {d.bodies.map((b) => <span key={b} className="chip">Contrata con {b}</span>)}
              </div>
            </div>
            <div className="company-hero-figures">
              <CountUp className="hero-big" value={d.total} />
              <span>cobrados en Cornellà</span>
              {d.first_date && (
                <p className="since">
                  Trabaja con Cornellà desde <strong>{monthYear(d.first_date)}</strong>
                  {d.last_date && d.last_date !== d.first_date && <> · último contrato en {monthYear(d.last_date)}</>}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap page">
        <dl className="stat-strip">
          <div><dt>Contratos</dt><dd><CountUp value={d.count} format={(n) => String(Math.round(n))} /></dd></div>
          <div><dt>Sin concurso abierto</dt><dd><CountUp value={d.direct_count} format={(n) => String(Math.round(n))} /></dd></div>
          <div><dt>Contrato medio</dt><dd>{eurosShort(d.total / Math.max(1, d.count))}</dd></div>
          <div><dt>Con señales</dt><dd className={pattern.length ? "warn" : ""}>{pattern.length}</dd></div>
        </dl>

        <div className="company-cols">
          <Reveal className="company-story">
            <SectionHead title="Quién es" />
            {p ? (
              <>
                <ol className="story">
                  {p.history.map((h, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                      {h}
                    </motion.li>
                  ))}
                </ol>
                <p className="sources">
                  Fuentes:{" "}
                  {p.sources.map((s, i) => (
                    <span key={s.url}>{i > 0 && " · "}<a href={s.url} rel="noreferrer" target="_blank">{s.label}</a></span>
                  ))}
                </p>
              </>
            ) : (
              <div className="empty-profile">
                <p>Todavía no hay una ficha pública verificada de esta empresa.</p>
                <p>
                  Por sus contratos, trabaja sobre todo en <strong>{d.by_category[0]?.name.toLowerCase()}</strong>
                  {d.places.length > 0 && <> y ha trabajado en {d.places.slice(0, 3).map((x) => x.name).join(", ")}</>}.
                </p>
              </div>
            )}
          </Reveal>
          <Reveal className="company-mix" delay={0.1}>
            <SectionHead title="Qué le compran" />
            <Donut groups={d.by_category} size={220} centerLabel="Total" />
            {d.by_year.length > 1 && <YearColumns rows={d.by_year} height={110} />}
          </Reveal>
        </div>

        <section className="band-inline">
          <SectionHead title="Su historia con Cornellà">
            <span className="hint">Cada punto es un contrato. Más arriba, más dinero.</span>
          </SectionHead>
          <Timeline contracts={awards} active={pick?.id} onPick={setPick} />
          <AnimatePresence mode="wait">
            {pick && (
              <motion.div key={pick.id} className="pick-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div>
                  <p className="kicker">{date(pick.date)} · {procedureLabel[pick.procedure_kind] ?? pick.procedure}</p>
                  <h3>{pick.description}</h3>
                  <Link className="link-arrow" to={`/contratos/${pick.id}`}>Ficha del contrato</Link>
                </div>
                <div>
                  <strong className="pick-amount">{euros(pick.amount)}</strong>
                  {pick.limit && pick.procedure_kind === "menor" && <LimitGauge amount={pick.amount} limit={pick.limit} />}
                </div>
                <button className="icon-btn" onClick={() => setPick(null)} aria-label="Cerrar">×</button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="band-inline">
          <SectionHead title="Qué ha hecho" />
          <div className="project-grid">
            {projects.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <Link to={`/contratos/${c.id}`} className="project-card">
                  <span className="project-meta">{date(c.date)}{c.event && ` · ${c.event}`}</span>
                  <span className="project-desc">{c.description}</span>
                  <span className="project-amount">{eurosShort(c.amount)}</span>
                </Link>
              </motion.div>
            ))}
          </div>
          {(d.places.length > 0 || d.events.length > 0) && (
            <div className="chips">
              {d.places.map((x) => <Link key={x.slug} className="chip" to="/mapa">{x.name}</Link>)}
              {d.events.map((x) => <Link key={x.slug} className="chip" to={`/eventos/${x.slug}`}>{x.name}</Link>)}
            </div>
          )}
          {d.repeated_amounts.length > 0 && (
            <p className="note-warn">
              Importe repetido: {d.repeated_amounts.map((r) => `${r.times} contratos de ${euros(r.amount)}`).join(" · ")}
            </p>
          )}
        </section>

        {pattern.length > 0 && (
          <section className="band-inline">
            <SectionHead title="Señales" />
            <div className="signal-grid">{pattern.map((s) => <SignalCard key={s.id} s={s} />)}</div>
          </section>
        )}

        {d.contracts.length > projects.length && (
          <section className="band-inline">
            <SectionHead title="Todos sus contratos" />
            <ContractList items={d.contracts} showSupplier={false} limit={10} />
          </section>
        )}
      </div>
    </>
  );
}
