import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="wrap page">
      <h1>Página no encontrada</h1>
      <p>
        La dirección no existe. <Link to="/">Volver al inicio</Link>.
      </p>
    </div>
  );
}
