import { Group, useApi } from "../api";
import { Breadcrumbs, ErrorBox, Loading } from "../components/Bits";
import { EventExplorer } from "../components/explorers";

export default function Events() {
  const { data, error, loading } = useApi<Group[]>("/api/events");
  return (
    <div className="wrap page">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Eventos" }]} />
      <h1>Lo que cuestan las fiestas</h1>
      <p className="lead-muted">Cada evento suma muchos contratos pequeños. Abre uno para verlo por dentro.</p>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && <EventExplorer events={data} initial={data[0]?.slug} />}
    </div>
  );
}
