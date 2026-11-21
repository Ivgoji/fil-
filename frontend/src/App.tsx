import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import Suppliers from "./pages/Suppliers";
import SupplierDetail from "./pages/SupplierDetail";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import MapPage from "./pages/MapPage";
import Signals from "./pages/Signals";
import Method from "./pages/Method";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="contratos" element={<Contracts />} />
        <Route path="contratos/:id" element={<ContractDetail />} />
        <Route path="empresas" element={<Suppliers />} />
        <Route path="empresas/:key" element={<SupplierDetail />} />
        <Route path="eventos" element={<Events />} />
        <Route path="eventos/:slug" element={<EventDetail />} />
        <Route path="mapa" element={<MapPage />} />
        <Route path="senales" element={<Signals />} />
        <Route path="como-funciona" element={<Method />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
