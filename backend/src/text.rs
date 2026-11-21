//! Utilidades de texto: normalización, tokens y similitud.

use std::collections::HashSet;

/// Corrige artefactos del registro (el apóstrofo llega como `¿`) y espacios.
pub fn clean(s: &str) -> String {
    let s = s.replace('¿', "'").replace('´', "'");
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Minúsculas sin acentos, para buscar con expresiones regulares.
pub fn fold(s: &str) -> String {
    deunicode::deunicode(s).to_lowercase()
}

const STOP: &[&str] = &[
    "de", "la", "el", "els", "les", "i", "a", "per", "al", "del", "dels", "en", "amb", "un", "una", "que",
    "pel", "pels", "lot", "contracte", "menor", "servei", "serveis", "obres", "ordinaries", "reparacio",
    "realitzacio", "subministrament", "contractar", "contractacio", "cornella", "llobregat", "los", "las",
    "y", "por", "para", "con",
];

pub fn tokens(s: &str) -> HashSet<String> {
    fold(s)
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| w.len() > 2 && !STOP.contains(w))
        .map(|w| w.to_string())
        .collect()
}

pub fn jaccard(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }
    let inter = a.intersection(b).count() as f64;
    let union = (a.len() + b.len()) as f64 - inter;
    if union == 0.0 { 0.0 } else { inter / union }
}

/// Clave para unificar razones sociales: "PROIDO CONSULTORS, S.L." y
/// "Proido Consultors SLP" acaban siendo la misma empresa.
pub fn supplier_key(name: &str) -> String {
    let f = fold(name);
    let mut words: Vec<&str> = f
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();
    const SUFFIX: &[&str] = &[
        "sl", "slu", "sa", "sau", "slp", "sccl", "scp", "sc", "sll", "s", "l", "u", "p", "unipersonal",
        "sociedad", "anonima", "limitada", "societat", "sad", "slne",
    ];
    while let Some(last) = words.last() {
        if SUFFIX.contains(last) {
            words.pop();
        } else {
            break;
        }
    }
    words.join("-")
}

/// Convierte un texto en identificador para URL.
pub fn slug(s: &str) -> String {
    let f = fold(s);
    let mut out = String::new();
    let mut dash = false;
    for c in f.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unifies_legal_forms() {
        assert_eq!(supplier_key("PROIDO CONSULTORS, S.L."), supplier_key("PROIDO CONSULTORS, SLP"));
        assert_eq!(supplier_key("Velvet Events SL"), "velvet-events");
    }

    #[test]
    fn similar_descriptions() {
        let a = tokens("Obres ordinàries de reparació menor de polit de la pista polisportiva de l'escola Sant Miquel");
        let b = tokens("Obres ordinàries de reparació menor de polit de la pista polisportiva de l'escola Sant Miquel");
        assert!(jaccard(&a, &b) > 0.99);
    }
}
