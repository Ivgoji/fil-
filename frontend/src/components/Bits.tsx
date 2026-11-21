import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Contract, Signal } from "../api";
import { date, euros, kindLabel, levelLabel, procedureLabel } from "../format";
import { useInView } from "../lib/hooks";
import { LimitGauge, Squiggle } from "./viz";

export function Loading() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Cargando">
      <span /><span /><span />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <strong>No se han podido cargar los datos.</strong> {message}. ¿Está el backend en marcha (<code>cargo run</code>)?
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { to?: string; label: string }[] }) {
  return (
    <nav aria-label="Ruta" className="crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={i}>{it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

/** Aparece al entrar en pantalla. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={seen ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHead({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <header className="section-head">
      <div>
        {kicker && <p className="kicker kicker-thread"><Squiggle />{kicker}</p>}
        <h2>{title}</h2>
      </div>
      {children && <div className="section-head-aside">{children}</div>}
    </header>
  );
}

export function SignalTag({ c }: { c: Contract }) {
  if (c.signal_ids.some((s) => s.startsWith("gemelos"))) return <span className="tag tag-warn">Gemelo</span>;
  if (c.signal_ids.some((s) => s.startsWith("recurrente"))) return <span className="tag tag-warn">Recurrente</span>;
  if (c.near_limit && c.limit) return <span className="tag">a {euros(c.limit - c.amount)} del límite</span>;
  return null;
}

/** Lista de contratos: cada fila se despliega para ver el detalle sin salir de la página. */
export function ContractList({ items, showSupplier = true, limit }: { items: Contract[]; showSupplier?: boolean; limit?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  if (items.length === 0) return <p className="status">No hay contratos que coincidan.</p>;
  const shown = limit && !all ? items.slice(0, limit) : items;
  return (
    <div className={`clist ${showSupplier ? "" : "no-supplier"}`}>
      {shown.map((c, i) => {
        const isOpen = open === c.id;
        return (
          <motion.div
            key={c.id}
            className={`crow ${isOpen ? "is-open" : ""}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03 }}
          >
            <button className="crow-head" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
              <span className="crow-date">{date(c.date)}</span>
              <span className="crow-desc">
                {c.description}
                <SignalTag c={c} />
              </span>
              {showSupplier && <span className="crow-supplier">{c.supplier}</span>}
              <span className="crow-amount">{euros(c.amount)}</span>
              <span className="crow-chev" aria-hidden="true">+</span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  className="crow-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="crow-inner">
                    <dl className="crow-facts">
                      <div><dt>Empresa</dt><dd><Link to={`/empresas/${c.supplier_key}`}>{c.supplier}</Link></dd></div>
                      <div><dt>Procedimiento</dt><dd>{procedureLabel[c.procedure_kind] ?? c.procedure}</dd></div>
                      <div><dt>Categoría</dt><dd>{c.category}</dd></div>
                      {c.event && <div><dt>Evento</dt><dd><Link to={`/eventos/${c.event_slug}`}>{c.event}</Link></dd></div>}
                      <div><dt>Contratante</dt><dd>{c.body}</dd></div>
                    </dl>
                    {c.limit && c.procedure_kind === "menor" && <LimitGauge amount={c.amount} limit={c.limit} />}
                    <Link className="link-arrow" to={`/contratos/${c.id}`}>Ficha completa</Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      {limit && items.length > limit && (
        <button className="btn-ghost" onClick={() => setAll(!all)}>
          {all ? "Ver menos" : `Ver los ${items.length} contratos`}
        </button>
      )}
    </div>
  );
}

/** Señal: muestra lo esencial y se despliega con los contratos implicados. */
export function SignalCard({ s, defaultOpen = false }: { s: Signal; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.article layout className={`signal signal-${s.level} ${open ? "is-open" : ""}`}>
      <button className="signal-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`level level-${s.level}`}>{levelLabel[s.level]}</span>
        <span className="signal-kind">{kindLabel[s.kind]}</span>
        <h3>{s.title}</h3>
        <span className="signal-total">{euros(s.total)}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="signal-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p>{s.explanation}</p>
            {s.limit && s.kind === "gemelos" && <LimitGauge amount={s.total} limit={s.limit} />}
            <ul className="signal-contracts">
              {s.contracts.map((c) => (
                <li key={c.id}>
                  <Link to={`/contratos/${c.id}`}>
                    <span>{c.supplier}</span>
                    <span>{date(c.date)}</span>
                    <strong>{euros(c.amount)}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
