//! Carga, limpieza y enriquecimiento de los contratos: categorías, eventos,
//! equipamientos, proveedores y señales.

use crate::places::{self, Geo};
use crate::text;
use anyhow::Context;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;

pub const ENS_AJ: &str = "Ajuntament de Cornellà de Llobregat";
pub const ENS_PRO: &str = "Empresa municipal de promoció social, urbana i econòmica de Cornellà Llobregat";

#[derive(Serialize, Clone, Debug)]
pub struct Contract {
    pub id: usize,
    /// "Ayuntamiento" o "Procornellà"
    pub body: String,
    pub file: String,
    pub procedure: String,
    /// menor | negociado | emergencia | abierto | acuerdo_marco | otros
    pub procedure_kind: String,
    pub contract_type: String,
    /// adjudicación | prórroga | modificación | liquidación
    pub status: String,
    /// true si es una adjudicación nueva (no prórroga ni modificación)
    pub is_award: bool,
    pub year: i32,
    pub date: Option<String>,
    pub amount: f64,
    pub supplier: String,
    pub supplier_key: String,
    pub description: String,
    pub lot: String,
    pub category: String,
    pub event: Option<String>,
    pub event_slug: Option<String>,
    pub place: Option<String>,
    pub limit: Option<f64>,
    pub near_limit: bool,
    pub signal_ids: Vec<String>,
    #[serde(skip)]
    pub tokens: HashSet<String>,
    #[serde(skip)]
    pub day: Option<i64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Signal {
    pub id: String,
    /// gemelos | limite | recurrente
    pub kind: String,
    /// alta | media | baja
    pub level: String,
    pub title: String,
    pub explanation: String,
    pub contract_ids: Vec<usize>,
    pub total: f64,
    pub limit: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Place {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
}

/// Ficha pública de una empresa adjudicataria (data/companies.json).
/// Se rellena a mano o con un paso de enriquecimiento; cada dato lleva su fuente.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Company {
    pub key: String,
    #[serde(default)]
    pub activity: String,
    #[serde(default)]
    pub sector: String,
    #[serde(default)]
    pub founded: Option<i32>,
    #[serde(default)]
    pub hq: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub history: Vec<String>,
    #[serde(default)]
    pub sources: Vec<Source>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Source {
    pub label: String,
    pub url: String,
}

pub struct Dataset {
    pub companies: Vec<Company>,
    pub contracts: Vec<Contract>,
    pub signals: Vec<Signal>,
    pub places: Vec<Place>,
    pub is_sample: bool,
    pub updated: String,
}

impl Dataset {
    pub fn load(data_dir: &Path) -> anyhow::Result<Self> {
        let raw_path = data_dir.join("raw.json");
        let (path, is_sample) = if raw_path.exists() {
            (raw_path, false)
        } else {
            eprintln!("No hay data/raw.json: uso la muestra. Ejecuta `cargo run --release -- ingest` para descargar los datos reales.");
            (data_dir.join("sample.json"), true)
        };
        let raw: Vec<Value> = serde_json::from_str(
            &std::fs::read_to_string(&path).with_context(|| format!("leyendo {}", path.display()))?,
        )?;
        let updated = std::fs::metadata(&path)
            .and_then(|m| m.modified())
            .ok()
            .map(|t| {
                let d: chrono::DateTime<chrono::Utc> = t.into();
                d.format("%Y-%m-%d").to_string()
            })
            .unwrap_or_default();

        let geo: Vec<Geo> = std::fs::read_to_string(data_dir.join("places.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        let mut contracts = build_contracts(&raw);
        let signals = detect_signals(&mut contracts);
        let used: HashSet<&str> = contracts.iter().filter_map(|c| c.place.as_deref()).collect();
        let places = places::PLACES
            .iter()
            .filter(|p| used.contains(p.id))
            .map(|p| {
                let g = geo.iter().find(|g| g.id == p.id);
                Place {
                    id: p.id.into(),
                    name: p.name.into(),
                    kind: p.kind.into(),
                    lat: g.map(|g| g.lat),
                    lon: g.map(|g| g.lon),
                }
            })
            .collect();
        let companies: Vec<Company> = match std::fs::read_to_string(data_dir.join("companies.json")) {
            Ok(txt) => serde_json::from_str(&txt).with_context(|| "leyendo data/companies.json")?,
            Err(_) => Vec::new(),
        };
        Ok(Dataset { companies, contracts, signals, places, is_sample, updated })
    }
}

fn s(v: &Value, k: &str) -> String {
    match v.get(k) {
        Some(Value::String(x)) => x.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn build_contracts(raw: &[Value]) -> Vec<Contract> {
    let prefix = Regex::new(r"(?i)^(exp\.?\s*)?\d{2}-\d{1,3}\s*(cp-cm|cm-cp|cm|cp)?\s*:?\s*|^exp\s*\S+\s*(cp-cm|cm-cp|cm|cp)?\s*:?\s*").unwrap();
    let rules = category_rules();
    let events = event_rules();

    let mut seen = HashSet::new();
    let mut out: Vec<Contract> = Vec::new();
    for r in raw {
        let org = s(r, "ORGANISME_CONTRACTANT");
        let body = if org == ENS_PRO { "Procornellà" } else if org == ENS_AJ { "Ayuntamiento" } else { continue };
        let supplier = text::clean(&s(r, "ADJUDICATARI"));
        let mut description = text::clean(&s(r, "DESCRIPCIO_EXPEDIENT"));
        if description.is_empty() {
            description = text::clean(&s(r, "CONTRACTE"));
        }
        let description = prefix.replace(&description, "").to_string();
        let amount: f64 = s(r, "IMPORT_ADJUDICACIO").parse().unwrap_or(0.0);
        let date = {
            let d = s(r, "DATA_ADJUDICACIO");
            if d.len() >= 10 { Some(d[..10].to_string()) } else { None }
        };
        let lot = s(r, "NUMERO_LOT");
        let status_raw = text::fold(&s(r, "SITUACIO_CONTRACTUAL"));
        let status = if status_raw.contains("prorroga") {
            "prórroga"
        } else if status_raw.contains("modificaci") {
            "modificación"
        } else if status_raw.contains("liquidaci") {
            "liquidación"
        } else {
            "adjudicación"
        };
        // El registro duplica muchos contratos (una fila como «menor» y otra como «adjudicació»).
        let desc80: String = description.chars().take(80).collect();
        let key = format!("{body}|{supplier}|{amount}|{date:?}|{desc80}|{lot}|{}", status == "adjudicación");
        if !seen.insert(key) {
            continue;
        }
        if supplier.eq_ignore_ascii_case("Lot desert") || amount <= 0.0 && status == "adjudicación" && supplier.is_empty() {
            continue;
        }

        let procedure = s(r, "PROCEDIMENT_ADJUDICACIO");
        let pf = text::fold(&procedure);
        let procedure_kind = if pf.contains("menor") {
            "menor"
        } else if pf.contains("negociat") {
            "negociado"
        } else if pf.contains("emergenc") {
            "emergencia"
        } else if pf.contains("acord marc") {
            "acuerdo_marco"
        } else if pf.contains("obert") {
            "abierto"
        } else {
            "otros"
        };
        let ct = s(r, "TIPUS_CONTRACTE");
        let contract_type = if ct.contains("OBRES") {
            "Obras"
        } else if ct.contains("SUBMINISTR") {
            "Suministros"
        } else if ct.contains("SERVEIS") {
            "Servicios"
        } else {
            "Otros"
        }
        .to_string();

        let folded = text::fold(&format!("{description} {supplier}"));
        let fdesc = text::fold(&description);
        let category = rules
            .iter()
            .find(|(_, re)| re.is_match(&fdesc) || re.is_match(&folded))
            .map(|(c, _)| c.to_string())
            .unwrap_or_else(|| "Otros".into());
        let mut event = events.iter().find(|(_, re)| re.is_match(&fdesc)).map(|(e, _)| e.to_string());
        if event.is_none() && body == "Procornellà" && category == "Espectáculos y conciertos" {
            event = Some("Programación del Auditori".into());
        }
        let place = places::detect(&fdesc).map(|p| p.id.to_string());

        let limit = if procedure_kind == "menor" {
            Some(if contract_type == "Obras" { 40000.0 } else { 15000.0 })
        } else {
            None
        };
        let near_limit = status == "adjudicación"
            && limit.map(|l| amount >= l * 0.93 && amount <= l).unwrap_or(false);
        let year = s(r, "EXERCICI").parse().unwrap_or(0);
        let day = date.as_deref().and_then(|d| {
            chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok().map(|nd| nd.num_days_from_ce() as i64)
        });

        out.push(Contract {
            id: 0,
            body: body.into(),
            file: s(r, "CODI_EXPEDIENT"),
            procedure,
            procedure_kind: procedure_kind.into(),
            contract_type,
            status: status.into(),
            is_award: status == "adjudicación",
            year,
            date,
            amount,
            supplier_key: text::supplier_key(&supplier),
            supplier,
            tokens: text::tokens(&description),
            description,
            lot,
            event_slug: event.as_deref().map(text::slug),
            event,
            category,
            place,
            limit,
            near_limit,
            signal_ids: vec![],
            day,
        });
    }
    // Más recientes primero; ids estables por orden.
    out.sort_by(|a, b| b.date.cmp(&a.date).then(b.amount.partial_cmp(&a.amount).unwrap()));
    for (i, c) in out.iter_mut().enumerate() {
        c.id = i + 1;
    }
    out
}

use chrono::Datelike;

fn category_rules() -> Vec<(&'static str, Regex)> {
    let r = |s: &str| Regex::new(s).unwrap();
    vec![
        ("Obras y mantenimiento de edificios", r(r"(actuacio|actuacions|obres) d'emergencia")),
        ("Mantenimiento urbano y zonas verdes", r(r"enllumenat public|manteniment electric")),
        ("Servicios sociales y educativos", r(r"atencio domiciliaria|ajuda a domicili|servei d'atencio personal|teleassistencia")),
        ("Deportes", r(r"socorris|activitats aquatiques|natacio|monitoratge esportiu")),
        ("Seguros y servicios financieros", r(r"polissa|responsabilitat civil")),
        ("Servicios generales y personal", r(r"estacionament|correspondencia|atencio a la ciutadania|atencio ciutadana|missatgeria")),
        ("Equipamiento y suministros", r(r"mobilitat sostenible|flota de vehicles|renting")),
        ("Espectáculos y conciertos", r(r"^auditori:|direccio artistica|espectale|espectaculo|representacion|festival arts|portenas")),
        ("Limpieza", r(r"\bneteja|limpieza")),
        ("Seguros y servicios financieros", r(r"assegura|seguros|financer")),
        ("Energía y combustibles", r(r"energia electrica|electricitat|gas natural|combustible|carburant|subministrament d'energia")),
        ("Software y tecnología", r(r"programari|software|llicencia|aplicacio informatica|plataforma|\berp\b|signatura biometrica|equipament informatic|hosting|koobin|vortal|stig|fas 2\.0|drets d'us|telecomunicacio")),
        ("Defensa y asesoría jurídica", r(r"juridic|advocat|defensa judicial|reparcel")),
        ("Patrocinios deportivos", r(r"patrocini|club basquetbol|foment de l'esport")),
        ("Servicios sociales y educativos", r(r"atencio terapeutica|escola bressol|educacio infantil|atencio a persones|serveis socials|trastorn mental")),
        ("Espectáculos y conciertos", r(r"espectacl|actuacio (musical|artistica)|actuacions musicals|concert|exhibicio|opera|monolog|teatre|musical|flamenco|cia\.|companyia|cinema|conferenc|gala|programa de radio")),
        ("Producción de fiestas y ferias", r(r"produccio tecnica|logistica derivada|fira|carpes|tarima|inflable|atraccio|monitors de lleure|decoracio|regidori|muntatge i desmuntatge|so i llum|sonoritzacio|pista de patinatge|piruletes|castellers|nadal|reis|corpus|backstage|stands|remolc escenari|contenidors i moduls|enllumenat de nadal|llums de nadal")),
        ("Mantenimiento urbano y zonas verdes", r(r"espais verds|jardineria|enjardinad|arbrat|esporga|via publica|enllumenat public|semafor|fonts ornamentals")),
        ("Obras y mantenimiento de edificios", r(r"\bobr(a|es)\b|revestiment|escomesa|barana|toldo|font del museu|obra|reparacio|cobert|facan|sostre|impermeabilitz|paviment|pintura|caldera|canonad|fusteri|enrajolat|parquet|clavegueram|facana|enderroc|climatitzacio|deshumectadora|refredadora|aerotermia|instal.lacio electrica|il.luminacio|ascensor|muntacarregues|elevador|parallamps|contra incendis|baixa tensio|manteniment")),
        ("Estudios, proyectos y asistencia técnica", r(r"estudi|projecte|redaccio|assistencia tecnica|direccio (d'obra|facultativa|de les obres|d'execucio)|consultori|assessorament|diagnosi|plec|memoria tecnica|coordinacio de seguretat|pla |analisi")),
        ("Servicios sociales y educativos", r(r"taller|dones|igualtat|violenc|jove|famil|infants|terapeut|social|socioeduca|educati|sexual|autoajuda|mediacio cultural|atencio public")),
        ("Deportes", r(r"esport|fitness|les mills|gym|piscina|pista|atletisme")),
        ("Comunicación y publicidad", r(r"disseny|marqueting|xarxes socials|campanya|impressio|publicitat|edicio|comunicacio")),
        ("Equipamiento y suministros", r(r"subministr|suministro|mobiliari|equips|lloguer|cortines|tela|sureres|palets|elements de joc|vehicle")),
        ("Servicios generales y personal", r(r"suport tecnic|servei nocturn|selecci|gerent|transport|tractament documental|docents|organitzacio i desenvolupament|vigilancia|seguretat|consergeria")),
    ]
}

fn event_rules() -> Vec<(&'static str, Regex)> {
    let r = |s: &str| Regex::new(s).unwrap();
    vec![
        ("Fiestas del Corpus", r(r"corpus")),
        ("Navidad y Reyes", r(r"nadal|reis|cavalcada|santa llucia")),
        ("Carnaval", r(r"carnestoltes|quaresma")),
        ("Sant Jordi y Fira del Llibre", r(r"sant jordi|fira del llibre|piruletes")),
        ("Festival de Pallassos", r(r"pallass")),
        ("Festival Flamenco", r(r"flamenco")),
        ("Nits d'Estiu", r(r"nits d'estiu")),
        ("Fòrum Cornellà Creació", r(r"forum de cornella|forum cornella|cornella creacio")),
        ("Festa Jove de l'Esport", r(r"festa jove de l'esport|cloenda de l'esport")),
        ("Cornellà Escena", r(r"cornella e?escena")),
    ]
}

fn fmt_eur(v: f64) -> String {
    let n = v.round() as i64;
    let s = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    format!("{}{} €", if n < 0 { "-" } else { "" }, out)
}

/// Detecta señales. Ninguna es una acusación: son patrones que un auditor revisaría.
fn detect_signals(cs: &mut [Contract]) -> Vec<Signal> {
    let mut signals = Vec::new();
    let idx: Vec<usize> = (0..cs.len())
        .filter(|&i| cs[i].procedure_kind == "menor" && cs[i].is_award && cs[i].amount > 0.0)
        .collect();

    // 1) Contratos gemelos: mismo ente, objeto casi idéntico, adjudicados con ≤ 60 días de diferencia.
    let mut parent: HashMap<usize, usize> = HashMap::new();
    fn find(p: &mut HashMap<usize, usize>, x: usize) -> usize {
        let px = *p.get(&x).unwrap_or(&x);
        if px == x {
            return x;
        }
        let r = find(p, px);
        p.insert(x, r);
        r
    }
    let mut recurrent: Vec<(usize, usize)> = Vec::new();
    for (n, &i) in idx.iter().enumerate() {
        for &j in &idx[n + 1..] {
            let (a, b) = (&cs[i], &cs[j]);
            if a.body != b.body {
                continue;
            }
            let (Some(da), Some(db)) = (a.day, b.day) else { continue };
            let gap = (da - db).abs();
            let sim = text::jaccard(&a.tokens, &b.tokens);
            if gap <= 60 && sim >= 0.55 {
                let (ri, rj) = (find(&mut parent, i), find(&mut parent, j));
                if ri != rj {
                    parent.insert(ri, rj);
                }
            } else if (300..=430).contains(&gap)
                && sim >= 0.5
                && a.supplier_key == b.supplier_key
                && a.category != "Espectáculos y conciertos"
            {
                recurrent.push((i, j));
            }
        }
    }
    let mut groups: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for &i in &idx {
        if parent.contains_key(&i) || parent.values().any(|&v| v == i) {
            let r = find(&mut parent, i);
            groups.entry(r).or_default().push(i);
        }
    }
    for (_, mut g) in groups {
        if g.len() < 2 {
            continue;
        }
        g.sort_by_key(|&i| cs[i].day);
        let total: f64 = g.iter().map(|&i| cs[i].amount).sum();
        let limit = if g.iter().any(|&i| cs[i].contract_type == "Obras") { 40000.0 } else { 15000.0 };
        let suppliers: HashSet<&str> = g.iter().map(|&i| cs[i].supplier_key.as_str()).collect();
        let same_day = g.iter().map(|&i| cs[i].day).collect::<HashSet<_>>().len() == 1;
        let all_shows = g.iter().all(|&i| cs[i].category == "Espectáculos y conciertos");
        let over = total > limit;
        let level = if over && suppliers.len() == 1 {
            "alta"
        } else if over || same_day {
            "media"
        } else {
            "baja"
        };
        if all_shows && !over {
            continue; // funciones distintas del mismo espectáculo: no aportan
        }
        let title = if suppliers.len() == 1 {
            format!("{} contratos casi iguales a {}", g.len(), cs[g[0]].supplier)
        } else {
            format!("{} empresas para el mismo trabajo", suppliers.len())
        };
        let when = if same_day { "el mismo día".to_string() } else { "en pocas semanas".to_string() };
        let explanation = format!(
            "{} contratos {}: {} en total{}",
            g.len(),
            when,
            fmt_eur(total),
            if over { format!(", por encima del límite de {}.", fmt_eur(limit)) } else { format!(" (límite {}).", fmt_eur(limit)) }
        );
        let id = format!("gemelos-{}", cs[g[0]].id);
        for &i in &g {
            cs[i].signal_ids.push(id.clone());
        }
        signals.push(Signal {
            id,
            kind: "gemelos".into(),
            level: level.into(),
            title,
            explanation,
            contract_ids: g.iter().map(|&i| cs[i].id).collect(),
            total,
            limit: Some(limit),
        });
    }

    // 2) Servicios que se repiten cada año como contrato menor.
    let mut seen_pairs = HashSet::new();
    for (i, j) in recurrent {
        let key = (cs[i].supplier_key.clone(), cs[i].tokens.len().min(cs[j].tokens.len()));
        if !seen_pairs.insert((key, cs[i].id.min(cs[j].id))) {
            continue;
        }
        let (a, b) = if cs[i].day < cs[j].day { (i, j) } else { (j, i) };
        let id = format!("recurrente-{}-{}", cs[a].id, cs[b].id);
        cs[a].signal_ids.push(id.clone());
        cs[b].signal_ids.push(id.clone());
        signals.push(Signal {
            id,
            kind: "recurrente".into(),
            level: "baja".into(),
            title: format!("{}, cada año", cs[a].supplier),
            explanation: format!(
                "Contrato menor en {} y otra vez en {} ({} y {}).",
                cs[a].year, cs[b].year, fmt_eur(cs[a].amount), fmt_eur(cs[b].amount)
            ),
            contract_ids: vec![cs[a].id, cs[b].id],
            total: cs[a].amount + cs[b].amount,
            limit: cs[a].limit,
        });
    }

    // 3) Pegados al límite: un indicador por contrato (no un aviso individual).
    for c in cs.iter_mut().filter(|c| c.near_limit) {
        let id = format!("limite-{}", c.id);
        c.signal_ids.push(id.clone());
        let l = c.limit.unwrap_or(0.0);
        signals.push(Signal {
            id,
            kind: "limite".into(),
            level: "baja".into(),
            title: format!("A {} del límite legal", fmt_eur(l - c.amount)),
            explanation: format!(
                "{} de un máximo de {}.",
                fmt_eur(c.amount),
                fmt_eur(l)
            ),
            contract_ids: vec![c.id],
            total: c.amount,
            limit: c.limit,
        });
    }
    signals.sort_by(|a, b| {
        let rank = |l: &str| match l { "alta" => 0, "media" => 1, _ => 2 };
        rank(&a.level).cmp(&rank(&b.level)).then(b.total.partial_cmp(&a.total).unwrap())
    });
    signals
}

