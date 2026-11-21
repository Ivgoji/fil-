import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Meta, STATIC, useApi } from "../api";
import { date } from "../format";

const NAV = [
  { to: "/", label: "Inicio", end: true },
  { to: "/contratos", label: "Contratos" },
  { to: "/empresas", label: "Empresas" },
  { to: "/eventos", label: "Eventos" },
  { to: "/mapa", label: "Mapa" },
  { to: "/senales", label: "Señales" },
  { to: "/como-funciona", label: "Metodología" },
];

/** El hilo: una sola línea que se puede seguir hasta el punto final. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <rect className="logo-bg" width="64" height="64" rx="14" fill="#0000FF" />
      <path
        className="logo-thread"
        d="M12 44 C 12 24, 26 24, 26 34 S 40 46, 40 30 S 50 16, 52 20"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={1}
      />
      <circle className="logo-dot" cx="52" cy="20" r="5.5" fill="#fff" />
    </svg>
  );
}

/** Hilo bajo la cabecera: se va tejiendo según bajas por la página. */
function ScrollThread() {
  const progress = useMotionValue(0);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.set(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [progress]);
  const p = useSpring(progress, { stiffness: 140, damping: 26, mass: 0.3 });
  const clip = useTransform(p, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`);
  const dot = useTransform(p, (v) => `${v * 100}%`);
  const wave = Array.from({ length: 80 }, (_, i) => `Q ${i * 25 + 12.5} ${i % 2 ? 9 : 1} ${(i + 1) * 25} 5`).join(" ");
  return (
    <div className="scroll-thread" aria-hidden="true">
      <svg viewBox="0 0 2000 10" preserveAspectRatio="xMinYMid slice"><path d={`M 0 5 ${wave}`} className="scroll-thread-track" /></svg>
      <motion.svg viewBox="0 0 2000 10" preserveAspectRatio="xMinYMid slice" style={{ clipPath: clip }}>
        <path d={`M 0 5 ${wave}`} className="scroll-thread-line" />
      </motion.svg>
      <motion.span className="scroll-thread-dot" style={{ left: dot }} />
    </div>
  );
}

export default function Layout() {
  const { data: meta } = useApi<Meta>("/api/meta");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  function search(e: FormEvent) {
    e.preventDefault();
    nav(`/contratos?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="wrap header-inner">
          <Link to="/" className="brand" aria-label="Fil, inicio">
            <Logo />
            <span className="brand-name">fil</span>
            <span className="brand-city">Cornellà</span>
          </Link>
          <nav id="menu" className={`main-nav ${open ? "open" : ""}`} aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
            ))}
          </nav>
          <form className="header-search" role="search" onSubmit={search}>
            <label htmlFor="header-q" className="sr-only">Buscar contratos</label>
            <input id="header-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
          </form>
          <button className="menu-toggle" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
            <span /><span /><span />
            <span className="sr-only">Menú</span>
          </button>
        </div>
        <ScrollThread />
      </header>
      {meta?.is_sample && (
        <div className="sample-pill" role="status">
          {STATIC ? (
            <>Datos de muestra: una selección de contratos reales para enseñar la web</>
          ) : (
            <>Datos de muestra · <code>cargo run --release -- ingest</code> carga el registro completo</>
          )}
        </div>
      )}

      <main id="contenido">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <Link to="/" className="brand brand-light"><Logo /><span className="brand-name">fil</span></Link>
            <p>Segueix el fil dels diners. A dónde va el dinero público de Cornellà de Llobregat. Proyecto independiente.</p>
          </div>
          <nav aria-label="Pie">
            {NAV.slice(1).map((n) => (
              <Link key={n.to} to={n.to}>{n.label}</Link>
            ))}
          </nav>
          <div className="footer-meta">
            <a href="https://dadesobertes.seu-e.cat/dataset/dades-de-contractes-de-catalunya-informats-al-registre-public-de-contractes" rel="noreferrer">
              Fuente: Registre Públic de Contractes
            </a>
            {meta && <span>Actualizado {date(meta.updated)}</span>}
          </div>
        </div>
      </footer>
    </>
  );
}
