//! Equipamientos municipales que se reconocen en las descripciones de los
//! contratos. Las coordenadas se obtienen en la ingesta con OpenStreetMap
//! (Nominatim) y se guardan en `data/places.json`.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

pub struct PlaceDef {
    pub id: &'static str,
    pub name: &'static str,
    pub kind: &'static str,
    pub pattern: &'static str,
    /// Texto que se envía al geocodificador.
    pub query: &'static str,
}

pub const PLACES: &[PlaceDef] = &[
    PlaceDef { id: "escola-sant-miquel", name: "Escola Sant Miquel", kind: "Escuela", pattern: r"escola sant miquel", query: "Escola Sant Miquel, Cornellà de Llobregat" },
    PlaceDef { id: "escola-mediterrania", name: "Escola Mediterrània", kind: "Escuela", pattern: r"escola mediterrania", query: "Escola Mediterrània, Cornellà de Llobregat" },
    PlaceDef { id: "escola-martinet", name: "Escola Martinet", kind: "Escuela", pattern: r"escola martinet", query: "Escola Martinet, Cornellà de Llobregat" },
    PlaceDef { id: "escola-areny", name: "Escola Areny", kind: "Escuela", pattern: r"escola areny", query: "Escola Areny, Cornellà de Llobregat" },
    PlaceDef { id: "escola-edelweiss", name: "Escola Edelweiss", kind: "Escuela", pattern: r"escola edelweiss", query: "Escola Edelweiss, Cornellà de Llobregat" },
    PlaceDef { id: "escola-sant-ildefons", name: "Escola Sant Ildefons", kind: "Escuela", pattern: r"escola sant ildefons", query: "Escola Sant Ildefons, Cornellà de Llobregat" },
    PlaceDef { id: "ceip-suris", name: "CEIP Suris", kind: "Escuela", pattern: r"ceip suris", query: "Escola Suris, Cornellà de Llobregat" },
    PlaceDef { id: "mercat-sant-ildefons", name: "Mercat Sant Ildefons", kind: "Mercado", pattern: r"mercat (de )?sant ildefons", query: "Mercat de Sant Ildefons, Cornellà de Llobregat" },
    PlaceDef { id: "mercat-centre", name: "Mercat Centre", kind: "Mercado", pattern: r"mercat (del )?centre", query: "Mercat del Centre, Cornellà de Llobregat" },
    PlaceDef { id: "estadi-pilar-pons", name: "Estadi Municipal Pilar Pons", kind: "Instalación deportiva", pattern: r"pilar pons", query: "Estadi Municipal Pilar Pons, Cornellà de Llobregat" },
    PlaceDef { id: "piscina-can-millars", name: "Piscina Can Millars", kind: "Instalación deportiva", pattern: r"can millars", query: "Piscina Can Millars, Cornellà de Llobregat" },
    PlaceDef { id: "pell", name: "Parc Esportiu Llobregat", kind: "Instalación deportiva", pattern: r"parc esportiu( del)? llobregat|\bpell\b", query: "Parc Esportiu Llobregat, Cornellà de Llobregat" },
    PlaceDef { id: "complex-can-mercader", name: "Complex Aquàtic i Esportiu Can Mercader", kind: "Instalación deportiva", pattern: r"complex aquatic( i esportiu)? can mercader", query: "Complex Aquàtic Can Mercader, Cornellà de Llobregat" },
    PlaceDef { id: "pavello-almeda", name: "Pavelló Almeda", kind: "Instalación deportiva", pattern: r"pavello almeda", query: "Pavelló Almeda, Cornellà de Llobregat" },
    PlaceDef { id: "museu-palau-mercader", name: "Museu Palau Mercader", kind: "Museo", pattern: r"palau mercader|palau de can mercader", query: "Museu Palau Mercader, Cornellà de Llobregat" },
    PlaceDef { id: "arxiu-historic", name: "Arxiu Històric", kind: "Equipamiento cultural", pattern: r"arxiu historic", query: "Arxiu Històric, Cornellà de Llobregat" },
    PlaceDef { id: "ccre", name: "Centre Cultural Recreatiu Extremeny", kind: "Equipamiento cultural", pattern: r"centre cultural recreatiu extremeny", query: "Centre Cultural Recreatiu Extremeny, Cornellà de Llobregat" },
    PlaceDef { id: "auditori", name: "Auditori de Cornellà", kind: "Equipamiento cultural", pattern: r"\bauditori\b", query: "Auditori de Cornellà, Cornellà de Llobregat" },
    PlaceDef { id: "cc-sant-ildefons", name: "Centre Cívic Sant Ildefons", kind: "Centro cívico", pattern: r"centre civic sant ildefons", query: "Centre Cívic Sant Ildefons, Cornellà de Llobregat" },
    PlaceDef { id: "cc-garcia-nieto", name: "Centre Cívic García Nieto", kind: "Centro cívico", pattern: r"centre civic garcia nieto", query: "Centre Cívic Joan N. García-Nieto, Cornellà de Llobregat" },
    PlaceDef { id: "can-vallhonrat", name: "Can Vallhonrat", kind: "Edificio municipal", pattern: r"can vallhonrat", query: "Can Vallhonrat, Cornellà de Llobregat" },
    PlaceDef { id: "antiga-estacio", name: "Antigua estación FFCC", kind: "Edificio municipal", pattern: r"antiga estacio", query: "Estació de Cornellà, Cornellà de Llobregat" },
];

fn regexes() -> &'static Vec<Regex> {
    static R: OnceLock<Vec<Regex>> = OnceLock::new();
    R.get_or_init(|| PLACES.iter().map(|p| Regex::new(p.pattern).unwrap()).collect())
}

/// Devuelve el equipamiento que menciona un texto ya plegado (`text::fold`).
pub fn detect(folded: &str) -> Option<&'static PlaceDef> {
    PLACES.iter().zip(regexes()).find(|(_, re)| re.is_match(folded)).map(|(p, _)| p)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Geo {
    pub id: String,
    pub lat: f64,
    pub lon: f64,
}
