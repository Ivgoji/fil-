import { Breadcrumbs } from "../components/Bits";
import { MapExplorer } from "../components/explorers";

export default function MapPage() {
  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Mapa" }]} />
      <h1>Dónde se gasta</h1>
      <p className="lead-muted">Obras y servicios situados en el equipamiento que menciona cada contrato. Círculo más grande, más dinero; borde naranja, con señales.</p>
      <MapExplorer tall />
    </div>
  );
}
