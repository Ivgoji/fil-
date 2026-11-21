import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Link, useNavigate } from "react-router-dom";
import { CategoryDetail, Contract, EventDetailData, Group, PlaceRow, SupplierRow, useApi } from "../api";
import { euros, eurosShort } from "../format";
import { ContractList, Loading } from "./Bits";
import { CountUp, Donut, HBars, YearColumns } from "./viz";

const panelAnim = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

/* ---------- Tipo de gasto: lista ordenada que se despliega ---------- */

export function CategoryList({ groups, initial }: { groups: Group[]; initial?: string | null }) {
  const [open, setOpen] = useState<string | null>(initial ?? null);
  useEffect(() => {
    if (initial) setOpen(initial);
  }, [initial]);
  const total = groups.reduce((a, g) => a + g.total, 0) || 1;
  const max = Math.max(...groups.map((g) => g.total), 1);
  return (
    <ol className="rank">
      {groups.map((g, i) => {
        const isOpen = open === g.slug;
        return (
          <motion.li
            key={g.slug}
            className={`rank-row ${isOpen ? "is-open" : ""}`}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <button className="rank-head" onClick={() => setOpen(isOpen ? null : g.slug)} aria-expanded={isOpen}>
              <span className="rank-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="rank-name">
                {g.name}
                <small>{g.count} {g.count === 1 ? "contrato" : "contratos"}</small>
              </span>
              <span className="rank-bar">
                <motion.span
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(1.5, (g.total / max) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="rank-value">
                {eurosShort(g.total)}
                <small>{Math.round((g.total / total) * 100)}%</small>
              </span>
              <span className="rank-chev" aria-hidden="true">+</span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && <CategoryDrawer slug={g.slug} />}
            </AnimatePresence>
          </motion.li>
        );
      })}
    </ol>
  );
}

function CategoryDrawer({ slug }: { slug: string }) {
  const { data } = useApi<CategoryDetail>(`/api/categories/${slug}`);
  const nav = useNavigate();
  return (
    <motion.div
      className="rank-drawer"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="rank-drawer-inner">
          <div className="rank-drawer-grid">
            <div>
              <h4>Por año</h4>
              <YearColumns rows={data.by_year} height={120} />
              <p className="panel-sub">{Math.round((data.direct_count / data.count) * 100)}% sin concurso abierto</p>
            </div>
            <div>
              <h4>Quién lo cobra</h4>
              <HBars
                rows={data.suppliers.slice(0, 5).map((x) => ({ id: x.key, label: x.name, value: x.total, sub: `${x.count} contr.` }))}
                onPick={(k) => nav(`/empresas/${k}`)}
              />
              {data.places.length > 0 && (
                <>
                  <h4>Dónde</h4>
                  <div className="chips">
                    {data.places.map((p) => (
                      <Link key={p.slug} className="chip" to="/mapa">{p.name} <b>{eurosShort(p.total)}</b></Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <h4>Contratos más grandes</h4>
          <ContractList items={data.contracts} limit={4} />
        </div>
      )}
    </motion.div>
  );
}

/* ---------- Eventos: tarjetas que se abren ---------- */

export function EventExplorer({ events, initial }: { events: Group[]; initial?: string | null }) {
  const [sel, setSel] = useState<string | null>(initial ?? null);
  const max = Math.max(...events.map((e) => e.total), 1);
  return (
    <div className="events">
      <div className="event-cards">
        {events.map((e, i) => (
          <motion.button
            key={e.slug}
            className={`event-card ${sel === e.slug ? "is-active" : ""} ${sel && sel !== e.slug ? "is-dim" : ""}`}
            onClick={() => setSel(sel === e.slug ? null : e.slug)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -4 }}
            aria-expanded={sel === e.slug}
          >
            <span className="event-name">{e.name}</span>
            <span className="event-figure">{eurosShort(e.total)}</span>
            <span className="event-meter"><span style={{ width: `${(e.total / max) * 100}%` }} /></span>
            <span className="event-meta">{e.count} {e.count === 1 ? "contrato" : "contratos"}</span>
            <span className="event-plus" aria-hidden="true">{sel === e.slug ? "−" : "+"}</span>
          </motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {sel && <EventPanel key={sel} slug={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

function EventPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data } = useApi<EventDetailData>(`/api/events/${slug}`);
  const [cat, setCat] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const list = useMemo(() => {
    let cs: Contract[] = data?.contracts ?? [];
    if (cat) cs = cs.filter((c) => data?.by_category.find((g) => g.slug === cat)?.name === c.category);
    if (supplier) cs = cs.filter((c) => c.supplier_key === supplier);
    return cs;
  }, [data, cat, supplier]);

  return (
    <motion.section
      className="event-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="event-panel-inner">
          <header className="event-panel-head">
            <div>
              <p className="kicker">Evento</p>
              <h3>{data.name}</h3>
            </div>
            <CountUp className="panel-figure" value={data.total} />
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
          </header>
          <div className="event-panel-grid">
            <div className="event-donut">
              <Donut groups={data.by_category} active={cat} onPick={(g) => setCat(g?.slug ?? null)} centerLabel="En qué se gasta" />
              <p className="hint">Pulsa un tramo para filtrar</p>
            </div>
            <div>
              <h4>Empresas</h4>
              <HBars
                rows={data.suppliers.map((s) => ({ id: s.key, label: s.name, value: s.total }))}
                active={supplier}
                onPick={(k) => setSupplier(supplier === k ? null : k)}
              />
              {data.by_year.length > 1 && (
                <>
                  <h4>Por edición</h4>
                  <YearColumns rows={data.by_year} height={110} />
                </>
              )}
            </div>
          </div>
          <div className="event-panel-list">
            <div className="list-head">
              <h4>{list.length} {list.length === 1 ? "contrato" : "contratos"}{cat || supplier ? " filtrados" : ""}</h4>
              {(cat || supplier) && <button className="btn-ghost" onClick={() => { setCat(null); setSupplier(null); }}>Quitar filtros</button>}
              <Link className="link-arrow" to={`/eventos/${data.slug}`}>Página del evento</Link>
            </div>
            <ContractList items={list} limit={6} />
          </div>
        </div>
      )}
    </motion.section>
  );
}

/* ---------- Mapa ---------- */

interface PlaceDetail {
  place: PlaceRow;
  total: number;
  count: number;
  flagged: number;
  contracts: Contract[];
}

const CENTER: [number, number] = [41.3565, 2.0765];

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 });
    else map.flyTo(CENTER, 14, { duration: 0.6 });
  }, [target, map]);
  return null;
}

function pinIcon(n: number, size: number, state: "idle" | "hover" | "active", flagged: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="pin pin-${state} ${flagged ? "pin-flag" : ""}" style="width:${size}px;height:${size}px;font-size:${Math.max(11, size / 3)}px">${n}</span>`,
  });
}

export function MapExplorer({ tall = false }: { tall?: boolean }) {
  const { data: places } = useApi<PlaceRow[]>("/api/places");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { data: detail } = useApi<PlaceDetail>(sel ? `/api/places/${sel}` : null);
  const [kind, setKind] = useState<string | null>(null);
  const all = places ?? [];
  const kinds = [...new Set(all.map((p) => p.kind))];
  const list = all.filter((p) => !kind || p.kind === kind);
  const located = list.filter((p) => p.lat != null && p.lon != null);
  const unlocated = list.filter((p) => p.lat == null || p.lon == null);
  const max = Math.max(...all.map((p) => p.total), 1);
  const numbered = all.filter((p) => p.lat != null && p.lon != null);
  const rankOf = (id: string) => numbered.findIndex((p) => p.id === id) + 1;
  const selPlace = all.find((p) => p.id === sel);
  const target: [number, number] | null = selPlace?.lat != null && selPlace?.lon != null ? [selPlace.lat, selPlace.lon] : null;
  const total = list.reduce((a, p) => a + p.total, 0);

  return (
    <div className={`mapx ${tall ? "is-tall" : ""}`}>
      <div className="mapx-filters chips">
        <button className={`chip ${!kind ? "is-on" : ""}`} onClick={() => setKind(null)}>Todo</button>
        {kinds.map((k) => (
          <button key={k} className={`chip ${kind === k ? "is-on" : ""}`} onClick={() => setKind(kind === k ? null : k)}>{k}</button>
        ))}
      </div>
      <div className="mapx-grid">
        <div className="mapx-map">
          <MapContainer center={CENTER} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <FlyTo target={target} />
            {located.map((p) => {
              const size = Math.round(26 + Math.sqrt(p.total / max) * 34);
              const state = sel === p.id ? "active" : hover === p.id ? "hover" : "idle";
              return (
                <Marker
                  key={`${p.id}-${state}`}
                  position={[p.lat!, p.lon!]}
                  icon={pinIcon(rankOf(p.id), size, state, p.flagged > 0)}
                  zIndexOffset={state === "idle" ? 0 : 1000}
                  eventHandlers={{ click: () => setSel(p.id), mouseover: () => setHover(p.id), mouseout: () => setHover(null) }}
                >
                  <Tooltip direction="top" offset={[0, -size / 2]}>
                    <strong>{p.name}</strong><br />{euros(p.total)} · {p.count} contr.
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
          <div className="mapx-legend">
            <span><i className="pin pin-idle" style={{ width: 16, height: 16 }} /> Más grande, más dinero</span>
            <span><i className="pin pin-idle pin-flag" style={{ width: 16, height: 16 }} /> Con señales</span>
          </div>
        </div>
        <aside className="mapx-panel">
          <AnimatePresence mode="wait">
            {!sel ? (
              <motion.div key="ranking" {...panelAnim}>
                <p className="kicker">Equipamientos</p>
                <CountUp className="panel-figure" value={total} />
                <p className="panel-sub">en {list.length} edificios y espacios municipales</p>
                <ol className="place-list">
                  {[...located, ...unlocated].map((p) => (
                    <li key={p.id}>
                      <button
                        className={hover === p.id ? "is-hover" : ""}
                        onMouseEnter={() => setHover(p.id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setSel(p.id)}
                      >
                        <span className={`place-n ${p.flagged ? "is-flag" : ""} ${p.lat == null ? "is-none" : ""}`}>{p.lat == null ? "·" : rankOf(p.id)}</span>
                        <span className="place-name">{p.name}<small>{p.kind}{p.lat == null ? " · sin ubicar en el mapa" : ""}</small></span>
                        <span className="place-value">{eurosShort(p.total)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {unlocated.length > 0 && <p className="hint">Los «sin ubicar» se sitúan al ejecutar <code>ingest</code>.</p>}
              </motion.div>
            ) : !detail || detail.place.id !== sel ? (
              <motion.div key="loading" {...panelAnim}><Loading /></motion.div>
            ) : (
              <motion.div key={sel} {...panelAnim}>
                <button className="btn-ghost back" onClick={() => setSel(null)}>← Todos</button>
                <p className="kicker">{detail.place.kind}</p>
                <h3 className="panel-title">{detail.place.name}</h3>
                <CountUp className="panel-figure" value={detail.total} />
                <p className="panel-sub">
                  {detail.count} {detail.count === 1 ? "contrato" : "contratos"}{detail.flagged ? ` · ${detail.flagged} con señales` : ""}
                </p>
                <ContractList items={detail.contracts} showSupplier={false} limit={5} />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Empresas: ranking ---------- */

export function SupplierRanking({ rows, limit = 10 }: { rows: SupplierRow[]; limit?: number }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ol className="rank rank-companies">
      {rows.slice(0, limit).map((r, i) => (
        <motion.li
          key={r.key}
          className="rank-row"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04 }}
        >
          <Link className="rank-head" to={`/empresas/${r.key}`}>
            <span className="rank-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="rank-name">
              {r.flagged > 0 && <i className="dot-warn" title="Con señales" />}
              {shortName(r.name)}
              <small>
                {r.first_date && `Desde ${r.first_date.slice(0, 4)} · `}
                {r.activity ?? r.category}
              </small>
            </span>
            <span className="rank-bar">
              <motion.span
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max(1.5, (r.total / max) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span className="rank-value">
              {eurosShort(r.total)}
              <small>{r.count} {r.count === 1 ? "contrato" : "contratos"}</small>
            </span>
            <span className="rank-chev" aria-hidden="true">→</span>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}

export function shortName(name: string): string {
  return name
    .replace(/,?\s*(Sociedad Unipersonal|S\.?L\.?U\.?|S\.?L\.?L\.?|S\.?L\.?P?\.?|S\.?A\.?U?\.?|S\.?C\.?C\.?L\.?|S\.?C\.?P\.?|SL|SA)\.?$/i, "")
    .replace(/,?\s*(Sociedad Unipersonal|SLU|SL|SA)\.?$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
}
