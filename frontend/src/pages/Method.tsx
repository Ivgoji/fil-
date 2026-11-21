import { Breadcrumbs } from "../components/Bits";

export default function Method() {
  return (
    <div className="wrap page prose">
      <Breadcrumbs items={[{ to: "/", label: "Inicio" }, { label: "Cómo funciona" }]} />
      <h1>Cómo funciona</h1>
      <p className="lead-muted">De dónde salen los datos, qué hacemos con ellos y qué límites tienen.</p>

      <h2>La fuente</h2>
      <p>
        Todos los contratos proceden del Registre Públic de Contractes de la Generalitat de Catalunya, publicado como datos abiertos por el Consorci
        Administració Oberta de Catalunya. Incluimos los del Ayuntamiento de Cornellà de Llobregat y los de Procornellà, su empresa municipal.
      </p>

      <h2>Limpieza</h2>
      <ul>
        <li>El registro duplica muchos contratos (una fila como «menor» y otra como «adjudicación»). Los unificamos.</li>
        <li>Las prórrogas y modificaciones se muestran dentro del contrato original y no suman en los totales.</li>
        <li>Una misma empresa aparece con distintas formas jurídicas («S.L.», «SLP»…). Las agrupamos por nombre.</li>
        <li>Corregimos caracteres mal codificados (los apóstrofos llegan como «¿»).</li>
      </ul>

      <h2>Categorías, eventos y equipamientos</h2>
      <p>
        Cada contrato se clasifica según su descripción: qué se compra (obras, espectáculos, software…), si pertenece a un evento (Corpus, Navidad,
        festivales) y en qué equipamiento se ejecuta. Las coordenadas de los equipamientos salen del directorio Equipaments de Catalunya de la Generalitat y, si falta alguno, de OpenStreetMap. La clasificación es
        automática y puede equivocarse.
      </p>

      <h2>Las fichas de empresa</h2>
      <p>
        La historia y la actividad de cada empresa se redactan a partir de fuentes públicas (registros mercantiles, webs corporativas, prensa) y cada
        ficha enlaza sus fuentes. Si una empresa no tiene ficha, solo mostramos lo que se deduce de sus contratos.
      </p>

      <h2>Las señales</h2>
      <dl className="defs">
        <dt>Contratos gemelos</dt>
        <dd>Dos o más contratos menores con un objeto casi idéntico, adjudicados en menos de 60 días. Si juntos superan el límite legal, pueden ser un trabajo partido para evitar el concurso, o trabajos distintos con descripciones parecidas.</dd>
        <dt>Rozando el límite</dt>
        <dd>Contratos menores a menos de un 7% del máximo legal: 15.000 € en servicios y suministros, 40.000 € en obras (sin IVA).</dd>
        <dt>Servicio recurrente</dt>
        <dd>La misma empresa recibe cada año un contrato menor para el mismo servicio. Las necesidades periódicas suelen requerir un contrato con concurso.</dd>
      </dl>

      <h2>Lo que no sabemos</h2>
      <p>
        El registro no incluye la justificación de cada expediente. Una señal indica dónde mirar, no una conclusión. Si un dato es incorrecto o
        tienes contexto sobre un caso, puedes consultar el expediente en el perfil del contratante o pedirlo ejerciendo el derecho de acceso a la
        información pública.
      </p>
    </div>
  );
}
