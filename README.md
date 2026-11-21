# Fil · ¿A dónde va el dinero de Cornellà?

Web para explorar los contratos públicos del Ayuntamiento de Cornellà de Llobregat y de Procornellà: en qué se gasta, a quién se paga, cuánto cuestan las fiestas y los eventos, dónde se ejecutan las obras y qué contratos merecen una segunda mirada.

- **Backend:** Rust (axum). Descarga los datos abiertos, los limpia, los clasifica, detecta señales y sirve una API JSON y la web.
- **Frontend:** React + TypeScript (Vite), con un mapa de OpenStreetMap (Leaflet).

## Arrancar

Necesitas Rust (`rustup`). Node solo hace falta si cambias el frontend, porque `frontend/dist` ya viene compilado.

```bash
cd backend

# 1. Descargar los contratos reales y geolocalizar los equipamientos (un par de minutos)
cargo run --release -- ingest

# 2. Arrancar la web
cargo run --release
```

Abre http://localhost:8080.

Sin el paso 1, la web arranca con `data/sample.json`, una muestra de unos 50 contratos reales, y lo avisa con un banner.

## Desarrollar el frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, con /api redirigido al backend en :8080
npm run build    # genera frontend/dist, que sirve el backend
```

## Estructura

```
backend/src/
  main.rs      comandos `ingest` y `serve`
  ingest.rs    descarga del Registre Públic de Contractes y geocodificación (Nominatim)
  model.rs     limpieza, duplicados, categorías, eventos, equipamientos y señales
  places.rs    equipamientos municipales reconocibles en las descripciones
  text.rs      normalización de texto, similitud y unificación de empresas
  api.rs       API JSON y servidor de la web
frontend/src/
  pages/        Inicio, Contratos, Empresas, Eventos, Mapa, Señales, Metodología
  components/
    viz.tsx        treemap, burbujas, donut, barras, línea de tiempo y medidor (d3 + framer-motion)
    explorers.tsx  exploradores interactivos: tipo de gasto, eventos, mapa, empresas
    Bits.tsx       filas de contrato desplegables, tarjetas de señal, migas
  lib/          paleta (#0000FF) y hooks de animación
data/
  sample.json     muestra para probar sin conexión
  raw.json        datos reales (se crea con `ingest`)
  places.json     coordenadas de equipamientos (Equipaments de Catalunya; `ingest` completa las que falten)
  companies.json  fichas de empresa: actividad, fundación, grupo, historia y fuentes
```

## API

| Ruta | Qué devuelve |
|---|---|
| `GET /api/summary` | Cifras de portada, reparto por categoría, eventos, empresas y señales destacadas |
| `GET /api/contracts?q=&category=&procedure=&year=&body=&signals=&sort=&page=` | Contratos filtrados y paginados |
| `GET /api/contracts/{id}` | Detalle, señales, prórrogas y otros contratos de la empresa |
| `GET /api/categories/{slug}` | Desglose de un tipo de gasto: años, empresas, lugares y contratos |
| `GET /api/suppliers`, `/api/suppliers/{key}` | Empresas y ficha de empresa (con perfil, desde cuándo, lugares y eventos) |
| `GET /api/events`, `/api/events/{slug}` | Eventos y su desglose |
| `GET /api/places`, `/api/places/{id}` | Equipamientos con coordenadas y contratos |
| `GET /api/signals?kind=gemelos\|limite\|recurrente` | Señales con su explicación |

## Cómo se calculan las señales

- **Contratos gemelos:** contratos menores del mismo ente con objeto casi idéntico (similitud de texto ≥ 0,55) adjudicados con menos de 60 días de diferencia. Si suman más que el límite legal y son de la misma empresa, el nivel es alto.
- **Pegados al límite:** contratos menores a menos de un 7% del máximo (15.000 € en servicios y suministros, 40.000 € en obras).
- **Recurrentes:** la misma empresa y el mismo servicio como contrato menor en años consecutivos (sin contar espectáculos).

Una señal no es una irregularidad: es un patrón que conviene revisar con el expediente en la mano.

## Siguientes pasos

- Sustituir la similitud por palabras por un modelo de lenguaje, para reconocer como iguales objetos redactados de forma distinta y distinguir trabajos partidos de servicios anuales.
- Generar `companies.json` para todas las empresas con un modelo de lenguaje con búsqueda web, guardando siempre la fuente de cada dato. Hoy hay 8 fichas redactadas a mano.
- Ampliar la lista de equipamientos de `places.rs` o extraerlos automáticamente.
- Extender a otros municipios: todos los de Cataluña publican en el mismo registro.

Fuente: Registre Públic de Contractes de la Generalitat de Catalunya, vía datos abiertos del Consorci AOC.
