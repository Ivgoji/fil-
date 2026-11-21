import { motion, AnimatePresence } from "framer-motion";
import { arc as d3arc, pie as d3pie, PieArcDatum } from "d3-shape";
import { ReactNode, useMemo, useState } from "react";
import { Contract, Group, YearRow } from "../api";
import { categoryColor, shade, WARN } from "../lib/colors";
import { useCountUp, useInView, usePointer, useWidth } from "../lib/hooks";
import { date, euros, eurosShort } from "../format";

const ease = [0.22, 1, 0.36, 1] as const;

/* ---------- Tooltip ---------- */

export function Tip({ pos, children }: { pos: { x: number; y: number } | null; children: ReactNode }) {
  return (
    <AnimatePresence>
      {pos && children && (
        <motion.div
          className="tip"
          style={{ left: pos.x, top: pos.y }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Número que cuenta ---------- */

export function CountUp({ value, format = euros, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const v = useCountUp(value, seen);
  return (
    <span ref={ref} className={className}>
      {format(v)}
    </span>
  );
}

/* ---------- Barra de dinero: el total partido por categorías ---------- */

/**
 * El hilo del dinero: una sola hebra (el total) que se abre en una hebra por categoría
 * y cae sobre su tramo de la barra. El grosor de cada hebra es proporcional al importe.
 */
function MoneyThreads({ groups, total, seen, hover, active }: { groups: Group[]; total: number; seen: boolean; hover: Group | null; active?: string | null }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = W < 600 ? 80 : 120;
  const splitX = Math.min(170, W * 0.14);
  const splitY = H * 0.42;
  let acc = 0;
  const strands = groups.map((g, i) => {
    const share = g.total / total;
    const cx = (acc + share / 2) * W;
    acc += share;
    const mid = splitX + (cx - splitX) * 0.55;
    const d = `M ${splitX} ${splitY} C ${mid} ${splitY}, ${cx} ${splitY + (H - splitY) * 0.25}, ${cx} ${H}`;
    return { g, i, d, width: 2 + Math.sqrt(share) * 9 };
  });
  const focus = hover?.slug ?? active ?? null;
  return (
    <div ref={ref} className="moneythreads" style={{ height: H }} aria-hidden="true">
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <motion.path
            d={`M 4 6 C ${splitX * 0.35} 6, ${splitX * 0.45} ${splitY}, ${splitX} ${splitY}`}
            fill="none"
            stroke={shade(0)}
            strokeWidth={11}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: seen ? 1 : 0 }}
            transition={{ duration: 0.6, ease }}
          />
          {strands.map((s) => (
            <motion.path
              key={s.g.slug}
              d={s.d}
              fill="none"
              stroke={shade(Math.min(s.i, 5))}
              strokeWidth={s.width}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 1 }}
              animate={{ pathLength: seen ? 1 : 0, opacity: focus && focus !== s.g.slug ? 0.15 : 1 }}
              transition={{ pathLength: { duration: 0.9, delay: 0.5 + s.i * 0.07, ease }, opacity: { duration: 0.2 } }}
            />
          ))}
          <motion.circle cx={splitX} cy={splitY} r={8} fill={shade(0)} initial={{ scale: 0 }} animate={{ scale: seen ? 1 : 0 }} transition={{ delay: 0.5, duration: 0.25 }} />
        </svg>
      )}
    </div>
  );
}

export function MoneyBar({
  groups,
  active,
  onPick,
  threads = false,
}: {
  groups: Group[];
  active?: string | null;
  onPick?: (g: Group) => void;
  threads?: boolean;
}) {
  const total = groups.reduce((a, g) => a + g.total, 0) || 1;
  const [hover, setHover] = useState<Group | null>(null);
  const { ref, pos, onMove, onLeave } = usePointer<HTMLDivElement>();
  const [vref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="moneybar-wrap" onMouseMove={onMove} onMouseLeave={() => { onLeave(); setHover(null); }}>
      {threads && <MoneyThreads groups={groups} total={total} seen={seen} hover={hover} active={active} />}
      <div ref={vref} className="moneybar" role="list">
        {groups.map((g, i) => (
          <motion.button
            role="listitem"
            key={g.slug}
            className={`moneybar-seg ${active === g.slug ? "is-active" : ""} ${hover && hover.slug !== g.slug ? "is-dim" : ""}`}
            style={{ background: categoryColor(g.name, i) }}
            initial={{ width: 0 }}
            animate={{ width: seen ? `${(g.total / total) * 100}%` : 0 }}
            transition={{ duration: 0.9, delay: (threads ? 1.1 : 0) + i * 0.06, ease }}
            onMouseEnter={() => setHover(g)}
            onFocus={() => setHover(g)}
            onClick={() => onPick?.(g)}
            aria-label={`${g.name}: ${euros(g.total)}`}
          />
        ))}
      </div>
      <Tip pos={hover ? pos : null}>
        {hover && (
          <>
            <strong>{hover.name}</strong>
            <span>{euros(hover.total)} · {Math.round((hover.total / total) * 100)}%</span>
          </>
        )}
      </Tip>
    </div>
  );
}

/* ---------- Hebra pequeña para los números de sección ---------- */

export function Squiggle({ width = 44 }: { width?: number }) {
  const [ref, seen] = useInView<SVGSVGElement>();
  return (
    <svg ref={ref} className="squiggle" width={width} height={14} viewBox="0 0 44 14" aria-hidden="true">
      <motion.path
        d="M2 10 C 8 2, 14 2, 18 7 S 28 13, 32 7 S 38 3, 40 5"
        fill="none"
        stroke={shade(0)}
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: seen ? 1 : 0 }}
        transition={{ duration: 0.8, ease }}
      />
      <motion.circle cx={40} cy={5} r={3} fill={shade(0)} initial={{ scale: 0 }} animate={{ scale: seen ? 1 : 0 }} transition={{ delay: 0.7, duration: 0.25 }} />
    </svg>
  );
}

/* ---------- Donut ---------- */

export function Donut({
  groups,
  active,
  onPick,
  size = 240,
  centerLabel = "Total",
}: {
  groups: Group[];
  active?: string | null;
  onPick?: (g: Group | null) => void;
  size?: number;
  centerLabel?: string;
}) {
  const [hover, setHover] = useState<Group | null>(null);
  const total = groups.reduce((a, g) => a + g.total, 0);
  const r = size / 2;
  const arcs = useMemo(() => d3pie<Group>().value((g) => g.total).sort(null).padAngle(0.012)(groups), [groups]);
  const base = d3arc<PieArcDatum<Group>>().innerRadius(r * 0.62).outerRadius(r * 0.92).cornerRadius(3);
  const big = d3arc<PieArcDatum<Group>>().innerRadius(r * 0.6).outerRadius(r).cornerRadius(3);
  const focus = hover ?? groups.find((g) => g.slug === active) ?? null;
  return (
    <div className="donut-wrap">
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`${-r} ${-r} ${size} ${size}`} width={size} height={size} onMouseLeave={() => setHover(null)}>
        {arcs.map((a, i) => {
          const on = focus?.slug === a.data.slug;
          return (
            <motion.path
              key={a.data.slug}
              d={(on ? big(a) : base(a)) ?? ""}
              fill={shade(Math.min(7, i * 2))}
              opacity={focus && !on ? 0.35 : 1}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: focus && !on ? 0.35 : 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease }}
              style={{ cursor: onPick ? "pointer" : "default", transformOrigin: "0 0" }}
              onMouseEnter={() => setHover(a.data)}
              onClick={() => onPick?.(active === a.data.slug ? null : a.data)}
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <span>{focus ? focus.name : centerLabel}</span>
        <strong>{eurosShort(focus ? focus.total : total)}</strong>
        {focus && <small>{Math.round((focus.total / (total || 1)) * 100)}%</small>}
      </div>
    </div>
    {groups.length > 1 && (
      <ul className="legend">
        {groups.map((g, i) => (
          <li key={g.slug}>
            <button
              className={focus && focus.slug !== g.slug ? "is-dim" : ""}
              onMouseEnter={() => setHover(g)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick?.(active === g.slug ? null : g)}
              disabled={!onPick}
            >
              <i style={{ background: shade(Math.min(7, i * 2)) }} />
              {g.name}
              <b>{eurosShort(g.total)}</b>
            </button>
          </li>
        ))}
      </ul>
    )}
    </div>
  );
}

/* ---------- Columnas por año ---------- */

export function YearColumns({ rows, height = 160 }: { rows: YearRow[]; height?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.total), 1);
  if (rows.length === 0) return null;
  return (
    <div ref={ref} className="ycols" style={{ height }} onMouseLeave={() => setHover(null)}>
      {rows.map((r, i) => (
        <div key={r.year} className={`ycol ${hover != null && hover !== r.year ? "is-dim" : ""}`} onMouseEnter={() => setHover(r.year)}>
          <span className="ycol-value">{hover === r.year ? euros(r.total) : eurosShort(r.total)}</span>
          <motion.span
            className="ycol-bar"
            initial={{ height: 0 }}
            animate={{ height: seen ? `${Math.max(3, (r.total / max) * 100)}%` : 0 }}
            transition={{ duration: 0.8, delay: i * 0.08, ease }}
          />
          <span className="ycol-year">{r.year}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Barras horizontales ---------- */

export function HBars({
  rows,
  onPick,
  active,
  colorBy = "rank",
}: {
  rows: { id: string; label: string; value: number; sub?: string }[];
  onPick?: (id: string) => void;
  active?: string | null;
  colorBy?: "rank" | "single";
}) {
  const [ref, seen] = useInView<HTMLUListElement>();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul ref={ref} className="hbars">
      {rows.map((r, i) => (
        <li key={r.id} className={active && active !== r.id ? "is-dim" : ""}>
          <button type="button" onClick={() => onPick?.(r.id)} disabled={!onPick}>
            <span className="hbars-label">
              {r.label}
              {r.sub && <small>{r.sub}</small>}
            </span>
            <span className="hbars-track">
              <motion.span
                className="hbars-fill"
                style={{ background: colorBy === "single" ? shade(0) : shade(Math.min(i, 5)) }}
                initial={{ width: 0 }}
                animate={{ width: seen ? `${Math.max(1.5, (r.value / max) * 100)}%` : 0 }}
                transition={{ duration: 0.8, delay: i * 0.06, ease }}
              />
            </span>
            <span className="hbars-value">{eurosShort(r.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Línea de tiempo de contratos ---------- */

export function Timeline({ contracts, active, onPick }: { contracts: Contract[]; active?: number | null; onPick?: (c: Contract) => void }) {
  const dated = contracts.filter((c) => c.date);
  const [hover, setHover] = useState<Contract | null>(null);
  const { ref, pos, onMove, onLeave } = usePointer<HTMLDivElement>();
  const [vref, seen] = useInView<HTMLDivElement>();
  if (dated.length === 0) return null;
  const ts = dated.map((c) => new Date(c.date!).getTime());
  const minY = new Date(Math.min(...ts)).getFullYear();
  const maxY = new Date(Math.max(...ts)).getFullYear();
  const t0 = new Date(`${minY}-01-01`).getTime();
  const t1 = new Date(`${maxY + 1}-01-01`).getTime();
  const amounts = dated.map((c) => c.amount);
  const lo = Math.log10(Math.max(500, Math.min(...amounts) * 0.5));
  const hi = Math.log10(Math.max(...amounts) * 2);
  const maxA = Math.max(...amounts, 1);
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);
  return (
    <div ref={ref} className="timeline-wrap" onMouseMove={onMove} onMouseLeave={() => { onLeave(); setHover(null); }}>
      <div ref={vref} className="timeline">
        {years.map((y) => (
          <span key={y} className="timeline-year" style={{ left: `${((new Date(`${y}-01-01`).getTime() - t0) / (t1 - t0)) * 100}%` }}>
            {y}
          </span>
        ))}
        {dated.map((c, i) => {
          const x = (new Date(c.date!).getTime() - t0) / (t1 - t0);
          const y = hi === lo ? 0.5 : (Math.log10(Math.max(500, c.amount)) - lo) / (hi - lo);
          const d = 10 + Math.sqrt(c.amount / maxA) * 46;
          return (
            <motion.button
              key={c.id}
              className={`dot ${c.signal_ids.length ? "is-flagged" : ""} ${active === c.id ? "is-active" : ""}`}
              style={{ left: `${x * 100}%`, bottom: `calc(${12 + y * 72}% )`, width: d, height: d, marginLeft: -d / 2, marginBottom: -d / 2 }}
              initial={{ scale: 0 }}
              animate={seen ? { scale: 1 } : {}}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.05 * i }}
              onMouseEnter={() => setHover(c)}
              onClick={() => onPick?.(c)}
              aria-label={`${date(c.date)}: ${euros(c.amount)}`}
            />
          );
        })}
      </div>
      <Tip pos={hover ? pos : null}>
        {hover && (
          <>
            <strong>{euros(hover.amount)}</strong>
            <span>{date(hover.date)}</span>
            <em>{hover.description.slice(0, 90)}{hover.description.length > 90 ? "…" : ""}</em>
          </>
        )}
      </Tip>
    </div>
  );
}

/* ---------- Medidor frente al límite legal ---------- */

export function LimitGauge({ amount, limit }: { amount: number; limit: number }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const scale = Math.max(limit * 1.2, amount * 1.05);
  const over = amount > limit;
  return (
    <div ref={ref} className="gauge">
      <div className="gauge-track">
        <motion.div
          className="gauge-fill"
          style={{ background: over ? WARN : shade(0) }}
          initial={{ width: 0 }}
          animate={{ width: seen ? `${(amount / scale) * 100}%` : 0 }}
          transition={{ duration: 1.1, ease }}
        />
        <span className="gauge-limit" style={{ left: `${(limit / scale) * 100}%` }}>
          <span>Límite {euros(limit)}</span>
        </span>
      </div>
      <p className="gauge-caption">
        {over ? `Supera el límite en ${euros(amount - limit)}` : `Usa el ${(Math.floor((amount / limit) * 1000) / 10).toLocaleString("es-ES")}% del máximo permitido`}
      </p>
    </div>
  );
}
