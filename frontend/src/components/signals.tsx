import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Signal, useApi } from "../api";
import { date, euros } from "../format";
import { shade } from "../lib/colors";
import { useInView, usePointer } from "../lib/hooks";
import { Loading } from "./Bits";
import { shortName } from "./explorers";
import { Tip } from "./viz";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ---------- La regla en tres frases ---------- */

export function RuleExplainer() {
  const steps = [
    {
      n: "1",
      title: "Por debajo del límite, sin concurso",
      text: "Si una compra cuesta menos de 15.000 € (40.000 € si es una obra), el Ayuntamiento puede elegir la empresa directamente. Es un contrato menor.",
    },
    {
      n: "2",
      title: "Por encima, a concurso",
      text: "Si cuesta más, tiene que publicarlo y dejar que varias empresas compitan. Partir un trabajo en trozos para no llegar al límite está prohibido.",
    },
    {
      n: "3",
      title: "Fil señala lo que conviene mirar",
      text: "Contratos casi iguales firmados a la vez, o importes pegados al máximo. Pueden tener explicación: no son irregularidades.",
    },
  ];
  return (
    <ol className="rule-steps">
      {steps.map((s, i) => (
        <motion.li
          key={s.n}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12 }}
        >
          <span className="rule-n">{s.n}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </motion.li>
      ))}
    </ol>
  );
}

/* ---------- Regla: cada contrato menor como un punto frente a su límite ---------- */

interface LimitGroup {
  name: string;
  limit: number;
  count: number;
  near: number;
  points: { id: number; amount: number; near: boolean; twin: boolean; supplier: string; description: string }[];
}

export function LimitRulers() {
  const { data } = useApi<LimitGroup[]>("/api/limits");
  if (!data) return <Loading />;
  return (
    <div className="rulers">
      {data.filter((g) => g.count > 0).map((g) => <LimitRuler key={g.limit} g={g} />)}
    </div>
  );
}

function LimitRuler({ g }: { g: LimitGroup }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const { ref: pref, pos, onMove, onLeave } = usePointer<HTMLDivElement>();
  const [hover, setHover] = useState<LimitGroup["points"][number] | null>(null);
  const nav = useNavigate();
  const max = g.limit * 1.08;
  const x = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  const ticks = [0, 0.25, 0.5, 0.75].map((t) => t * g.limit);
  return (
    <div className="ruler" ref={ref}>
      <div className="ruler-head">
        <h3>{g.name}</h3>
        <p>
          <strong>{g.near}</strong> de {g.count} contratos menores están a menos de un 7% del límite de {euros(g.limit)}
        </p>
      </div>
      <div className="ruler-plot" ref={pref} onMouseMove={onMove} onMouseLeave={() => { onLeave(); setHover(null); }}>
        <motion.div
          className="ruler-zone"
          style={{ left: x(g.limit * 0.93), width: `calc(${x(g.limit)} - ${x(g.limit * 0.93)})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: seen ? 1 : 0 }}
          transition={{ delay: 0.3 }}
        >
          <span>Rozando el límite</span>
        </motion.div>
        <div className="ruler-limit" style={{ left: x(g.limit) }}>
          <span>Límite {euros(g.limit)}</span>
        </div>
        <div className="ruler-beyond" style={{ left: x(g.limit) }}>
          <span>A concurso</span>
        </div>
        {g.points.map((p, i) => {
          const jitter = ((p.id * 37) % 100) / 100;
          return (
            <motion.button
              key={p.id}
              className={`ruler-dot ${p.near ? "is-near" : ""} ${p.twin ? "is-twin" : ""}`}
              style={{ left: x(p.amount), top: `${18 + jitter * 56}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={seen ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.2 + (p.amount / g.limit) * 0.9 + i * 0.01, type: "spring", stiffness: 260, damping: 18 }}
              onMouseEnter={() => setHover(p)}
              onClick={() => nav(`/contratos/${p.id}`)}
              aria-label={`${p.supplier}: ${euros(p.amount)}`}
            />
          );
        })}
        <Tip pos={hover ? pos : null}>
          {hover && (
            <>
              <strong>{euros(hover.amount)}</strong>
              <span>{shortName(hover.supplier)}</span>
              <em>{hover.description.slice(0, 80)}{hover.description.length > 80 ? "…" : ""}</em>
            </>
          )}
        </Tip>
      </div>
      <div className="ruler-axis">
        {ticks.map((t) => (
          <span key={t} style={{ left: x(t) }}>{t === 0 ? "0 €" : `${(t / 1000).toLocaleString("es-ES")} mil €`}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Un caso de contratos gemelos, contado como una suma ---------- */

export function TwinCase({ s }: { s: Signal }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const limit = s.limit ?? 15000;
  const scale = Math.max(limit, s.total) * 1.12;
  const over = s.total > limit;
  const suppliers = [...new Set(s.contracts.map((c) => c.supplier_key))];
  const sameDay = new Set(s.contracts.map((c) => c.date)).size === 1;
  const what = s.contracts[0]?.description ?? s.title;
  return (
    <motion.article ref={ref} layout className={`twin ${over ? "is-over" : ""}`}>
      <div className="twin-tags">
        <span className={`level level-${s.level}`}>{over ? "Supera el límite" : "Por debajo del límite"}</span>
        <span>{sameDay ? "Mismo día" : "En pocas semanas"}</span>
        <span>{suppliers.length === 1 ? "Misma empresa" : `${suppliers.length} empresas`}</span>
      </div>
      <h3 className="twin-what">{what.length > 110 ? `${what.slice(0, 110)}…` : what}</h3>

      <div className="twin-bar">
        <div className="twin-track">
          {s.contracts.map((c, i) => (
            <motion.span
              key={c.id}
              className="twin-seg"
              style={{ background: shade(i * 2) }}
              initial={{ width: 0 }}
              animate={{ width: seen ? `${(c.amount / scale) * 100}%` : 0 }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.5, ease }}
              title={`${c.supplier}: ${euros(c.amount)}`}
            >
              <b>{euros(c.amount)}</b>
            </motion.span>
          ))}
        </div>
        <span className={`twin-limit ${limit / scale > 0.75 ? "is-right" : ""}`} style={{ left: `${(limit / scale) * 100}%` }}>
          <i>Límite {euros(limit)}</i>
        </span>
      </div>

      <p className="twin-sum">
        {s.contracts.map((c) => euros(c.amount)).join(" + ")} = <strong>{euros(s.total)}</strong>
        {over ? (
          <span className="warn"> · {euros(s.total - limit)} por encima del límite</span>
        ) : (
          <span> · {euros(limit - s.total)} por debajo del límite</span>
        )}
      </p>
      <p className="twin-why">
        {over
          ? suppliers.length === 1
            ? "Juntos, este trabajo habría tenido que ir a concurso. Puede estar justificado si son trabajos distintos."
            : "Juntos superan el límite. Al ser empresas distintas, conviene ver si es un mismo trabajo repartido."
          : "No supera el límite, pero son el mismo trabajo en contratos separados. Conviene saber por qué."}
      </p>

      <button className="btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Ocultar contratos" : `Ver los ${s.contracts.length} contratos`}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul className="twin-contracts" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {s.contracts.map((c, i) => (
              <li key={c.id}>
                <i style={{ background: shade(i * 2) }} />
                <Link to={`/contratos/${c.id}`}>
                  <span>{shortName(c.supplier)}</span>
                  <small>{date(c.date)}</small>
                </Link>
                <strong>{euros(c.amount)}</strong>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function TwinCases() {
  const { data } = useApi<{ items: Signal[] }>("/api/signals?kind=gemelos");
  if (!data) return <Loading />;
  if (data.items.length === 0) return <p className="status">No hay contratos gemelos.</p>;
  return (
    <div className="twins">
      {data.items.map((s) => <TwinCase key={s.id} s={s} />)}
    </div>
  );
}
