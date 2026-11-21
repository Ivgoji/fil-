//! API JSON y servidor de la web.

use crate::model::{Contract, Dataset, Signal};
use crate::text;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

type Db = Arc<Dataset>;

pub async fn serve(db: Db, dist: PathBuf, port: u16) -> anyhow::Result<()> {
    let api = Router::new()
        .route("/api/meta", get(meta))
        .route("/api/summary", get(summary))
        .route("/api/contracts", get(contracts))
        .route("/api/contracts/{id}", get(contract))
        .route("/api/categories", get(categories))
        .route("/api/categories/{slug}", get(category))
        .route("/api/suppliers", get(suppliers))
        .route("/api/suppliers/{key}", get(supplier))
        .route("/api/events", get(events))
        .route("/api/events/{slug}", get(event))
        .route("/api/places", get(places))
        .route("/api/places/{id}", get(place))
        .route("/api/signals", get(signals))
        .route("/api/limits", get(limits))
        .with_state(db);

    let app = if dist.join("index.html").exists() {
        let spa = ServeDir::new(&dist).fallback(ServeFile::new(dist.join("index.html")));
        api.fallback_service(spa)
    } else {
        eprintln!("Aviso: no encuentro {}. Compila el frontend (cd frontend && npm install && npm run build).", dist.display());
        api
    }
    .layer(CorsLayer::permissive());

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    println!("Fil en http://localhost:{port}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn not_found(what: &str) -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "error": format!("{what} no encontrado") }))).into_response()
}

/// Contratos que cuentan para los totales: adjudicaciones nuevas (no prórrogas ni modificaciones).
fn awards(db: &Dataset) -> impl Iterator<Item = &Contract> {
    db.contracts.iter().filter(|c| c.is_award)
}

fn is_direct(c: &Contract) -> bool {
    matches!(c.procedure_kind.as_str(), "menor" | "negociado" | "emergencia")
}

fn sum(it: impl Iterator<Item = f64>) -> f64 {
    it.sum::<f64>().round()
}

fn group<'a, F: Fn(&Contract) -> Option<String>>(cs: impl Iterator<Item = &'a Contract>, key: F) -> Vec<Value> {
    let mut m: HashMap<String, (f64, usize)> = HashMap::new();
    for c in cs {
        if let Some(k) = key(c) {
            let e = m.entry(k).or_default();
            e.0 += c.amount;
            e.1 += 1;
        }
    }
    let mut v: Vec<_> = m.into_iter().collect();
    v.sort_by(|a, b| b.1 .0.partial_cmp(&a.1 .0).unwrap());
    v.into_iter()
        .map(|(name, (total, count))| json!({ "name": name, "slug": text::slug(&name), "total": total.round(), "count": count }))
        .collect()
}

/// Agrupa por empresa conservando la clave para poder enlazar su ficha.
fn group_suppliers<'a>(cs: impl Iterator<Item = &'a Contract>) -> Vec<Value> {
    let mut m: HashMap<&str, (&str, f64, usize)> = HashMap::new();
    for c in cs {
        let e = m.entry(c.supplier_key.as_str()).or_insert((c.supplier.as_str(), 0.0, 0));
        e.1 += c.amount;
        e.2 += 1;
    }
    let mut v: Vec<_> = m.into_iter().collect();
    v.sort_by(|a, b| b.1 .1.partial_cmp(&a.1 .1).unwrap());
    v.into_iter()
        .map(|(k, (name, total, count))| json!({ "key": k, "name": name, "total": total.round(), "count": count }))
        .collect()
}

fn years_of<'a>(cs: impl Iterator<Item = &'a Contract>) -> Vec<Value> {
    let mut by_year: BTreeMap<i32, (f64, usize)> = BTreeMap::new();
    for c in cs.filter(|c| c.year > 2000) {
        let e = by_year.entry(c.year).or_default();
        e.0 += c.amount;
        e.1 += 1;
    }
    by_year.into_iter().map(|(y, (t, n))| json!({ "year": y, "total": t.round(), "count": n })).collect()
}

fn place_name(db: &Dataset, id: &str) -> String {
    db.places.iter().find(|p| p.id == id).map(|p| p.name.clone()).unwrap_or_else(|| id.to_string())
}

fn signal_json(db: &Dataset, s: &Signal) -> Value {
    let cs: Vec<&Contract> = s.contract_ids.iter().filter_map(|id| db.contracts.get(id - 1)).collect();
    json!({
        "id": s.id, "kind": s.kind, "level": s.level, "title": s.title, "explanation": s.explanation,
        "total": s.total.round(), "limit": s.limit, "contracts": cs,
    })
}

async fn meta(State(db): State<Db>) -> Json<Value> {
    Json(json!({
        "municipality": "Cornellà de Llobregat",
        "bodies": ["Ayuntamiento", "Procornellà"],
        "is_sample": db.is_sample,
        "updated": db.updated,
        "source": "Registre Públic de Contractes de la Generalitat de Catalunya, vía datos abiertos del Consorci AOC",
        "contracts": db.contracts.len(),
    }))
}

async fn summary(State(db): State<Db>) -> Json<Value> {
    let years: Vec<i32> = awards(&db).map(|c| c.year).filter(|y| *y > 2000 && *y < 2100).collect();
    let direct: Vec<&Contract> = awards(&db).filter(|c| is_direct(c)).collect();
    let menor: Vec<&&Contract> = direct.iter().filter(|c| c.procedure_kind == "menor").collect();
    let near: Vec<&&Contract> = menor.iter().copied().filter(|c| c.near_limit).collect();
    let twins: Vec<&Signal> = db.signals.iter().filter(|s| s.kind == "gemelos").collect();

    let mut by_year: BTreeMap<i32, (f64, usize)> = BTreeMap::new();
    for c in awards(&db).filter(|c| c.year > 2000 && c.year <= chrono_year()) {
        let e = by_year.entry(c.year).or_default();
        e.0 += c.amount;
        e.1 += 1;
    }
    let mut latest: Vec<&Contract> = awards(&db).filter(|c| c.date.is_some()).collect();
    latest.truncate(12);

    let highlighted: Vec<Value> = db
        .signals
        .iter()
        .filter(|s| s.kind != "limite")
        .take(4)
        .map(|s| signal_json(&db, s))
        .collect();

    Json(json!({
        "years": { "from": years.iter().min(), "to": years.iter().max() },
        "totals": {
            "awarded": sum(awards(&db).map(|c| c.amount)),
            "awarded_count": awards(&db).count(),
            "direct": sum(direct.iter().map(|c| c.amount)),
            "direct_count": direct.len(),
            "minor": sum(menor.iter().map(|c| c.amount)),
            "minor_count": menor.len(),
            "near_limit": sum(near.iter().map(|c| c.amount)),
            "near_limit_count": near.len(),
            "twin_groups": twins.len(),
            "twin_over_limit": twins.iter().filter(|s| s.limit.map(|l| s.total > l).unwrap_or(false)).count(),
            "suppliers": awards(&db).map(|c| c.supplier_key.as_str()).collect::<std::collections::HashSet<_>>().len(),
        },
        "by_category": group(awards(&db), |c| Some(c.category.clone())),
        "by_category_direct": group(direct.iter().copied(), |c| Some(c.category.clone())),
        "by_procedure": group(awards(&db), |c| Some(c.procedure_kind.clone())),
        "by_year": by_year.into_iter().map(|(y, (t, n))| json!({ "year": y, "total": t.round(), "count": n })).collect::<Vec<_>>(),
        "events": group(awards(&db), |c| c.event.clone()).into_iter().take(8).collect::<Vec<_>>(),
        "top_suppliers": top_suppliers(&db, None).into_iter().take(8).collect::<Vec<_>>(),
        "latest": latest,
        "signals": highlighted,
    }))
}

fn chrono_year() -> i32 {
    use chrono::Datelike;
    chrono::Utc::now().year()
}

#[derive(Deserialize, Default)]
struct ContractQuery {
    q: Option<String>,
    category: Option<String>,
    procedure: Option<String>,
    year: Option<i32>,
    body: Option<String>,
    signals: Option<bool>,
    include_extensions: Option<bool>,
    sort: Option<String>,
    page: Option<usize>,
    per_page: Option<usize>,
}

async fn contracts(State(db): State<Db>, Query(q): Query<ContractQuery>) -> Json<Value> {
    let needle = q.q.as_deref().map(text::fold).filter(|s| !s.is_empty());
    let mut v: Vec<&Contract> = db
        .contracts
        .iter()
        .filter(|c| c.is_award || q.include_extensions.unwrap_or(false))
        .filter(|c| q.category.as_deref().map(|x| text::slug(&c.category) == x).unwrap_or(true))
        .filter(|c| q.procedure.as_deref().map(|x| c.procedure_kind == x).unwrap_or(true))
        .filter(|c| q.year.map(|y| c.year == y).unwrap_or(true))
        .filter(|c| q.body.as_deref().map(|b| text::slug(&c.body) == b).unwrap_or(true))
        .filter(|c| !q.signals.unwrap_or(false) || !c.signal_ids.is_empty())
        .filter(|c| {
            needle
                .as_deref()
                .map(|n| text::fold(&format!("{} {} {}", c.description, c.supplier, c.event.as_deref().unwrap_or(""))).contains(n))
                .unwrap_or(true)
        })
        .collect();
    match q.sort.as_deref() {
        Some("amount") => v.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap()),
        Some("oldest") => v.sort_by(|a, b| a.date.cmp(&b.date)),
        _ => {}
    }
    let total = v.len();
    let amount = sum(v.iter().map(|c| c.amount));
    let per = q.per_page.unwrap_or(25).clamp(1, 200);
    let page = q.page.unwrap_or(1).max(1);
    let items: Vec<&Contract> = v.into_iter().skip((page - 1) * per).take(per).collect();
    Json(json!({ "total": total, "amount": amount, "page": page, "per_page": per, "items": items }))
}

async fn contract(State(db): State<Db>, Path(id): Path<usize>) -> Response {
    let Some(c) = id.checked_sub(1).and_then(|i| db.contracts.get(i)) else { return not_found("Contrato") };
    let signals: Vec<Value> = db
        .signals
        .iter()
        .filter(|s| c.signal_ids.contains(&s.id))
        .map(|s| signal_json(&db, s))
        .collect();
    let same_supplier: Vec<&Contract> = db
        .contracts
        .iter()
        .filter(|o| o.supplier_key == c.supplier_key && o.id != c.id)
        .take(10)
        .collect();
    let history: Vec<&Contract> = db
        .contracts
        .iter()
        .filter(|o| !o.is_award && o.file == c.file && o.supplier_key == c.supplier_key && o.id != c.id)
        .collect();
    Json(json!({ "contract": c, "signals": signals, "same_supplier": same_supplier, "history": history })).into_response()
}

async fn categories(State(db): State<Db>) -> Json<Value> {
    Json(json!(group(awards(&db), |c| Some(c.category.clone()))))
}

async fn category(State(db): State<Db>, Path(slug): Path<String>) -> Response {
    let mut cs: Vec<&Contract> = awards(&db).filter(|c| text::slug(&c.category) == slug).collect();
    if cs.is_empty() {
        return not_found("Categoría");
    }
    cs.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap());
    Json(json!({
        "name": cs[0].category,
        "slug": slug,
        "total": sum(cs.iter().map(|c| c.amount)),
        "count": cs.len(),
        "direct_count": cs.iter().filter(|c| is_direct(c)).count(),
        "by_year": years_of(cs.iter().copied()),
        "suppliers": group_suppliers(cs.iter().copied()).into_iter().take(8).collect::<Vec<_>>(),
        "places": group(cs.iter().copied(), |c| c.place.as_deref().map(|p| place_name(&db, p))).into_iter().take(6).collect::<Vec<_>>(),
        "contracts": cs.into_iter().take(30).collect::<Vec<_>>(),
    }))
    .into_response()
}

#[derive(Deserialize, Default)]
struct SupplierQuery {
    q: Option<String>,
}

fn top_suppliers(db: &Dataset, q: Option<&str>) -> Vec<Value> {
    let mut m: HashMap<&str, (String, f64, usize, usize, usize, Option<String>)> = HashMap::new();
    for c in awards(db) {
        let e = m.entry(c.supplier_key.as_str()).or_insert((c.supplier.clone(), 0.0, 0, 0, 0, None));
        e.1 += c.amount;
        e.2 += 1;
        if is_direct(c) {
            e.3 += 1;
        }
        if c.signal_ids.iter().any(|s| !s.starts_with("limite")) {
            e.4 += 1;
        }
        if e.5.as_deref().map(|d| c.date.as_deref() > Some(d)).unwrap_or(true) {
            e.5 = c.date.clone();
        }
    }
    let needle = q.map(text::fold);
    let mut v: Vec<_> = m
        .into_iter()
        .filter(|(_, e)| needle.as_deref().map(|n| text::fold(&e.0).contains(n)).unwrap_or(true))
        .collect();
    v.sort_by(|a, b| b.1 .1.partial_cmp(&a.1 .1).unwrap());
    v.into_iter()
        .map(|(k, (name, total, count, direct, flagged, last))| {
            let first = awards(db).filter(|c| c.supplier_key == k).filter_map(|c| c.date.clone()).min();
            let main_cat = group(awards(db).filter(|c| c.supplier_key == k), |c| Some(c.category.clone()))
                .first()
                .and_then(|g| g["name"].as_str().map(String::from));
            let profile = db.companies.iter().find(|p| p.key == k);
            json!({
                "key": k, "name": name, "total": total.round(), "count": count, "direct_count": direct, "flagged": flagged,
                "first_date": first, "last_date": last, "category": main_cat,
                "activity": profile.map(|p| p.activity.clone()), "sector": profile.map(|p| p.sector.clone()),
                "founded": profile.and_then(|p| p.founded), "has_profile": profile.is_some(),
            })
        })
        .collect()
}

async fn suppliers(State(db): State<Db>, Query(q): Query<SupplierQuery>) -> Json<Value> {
    Json(json!(top_suppliers(&db, q.q.as_deref())))
}

async fn supplier(State(db): State<Db>, Path(key): Path<String>) -> Response {
    let cs: Vec<&Contract> = db.contracts.iter().filter(|c| c.supplier_key == key).collect();
    if cs.is_empty() {
        return not_found("Proveedor");
    }
    let aw: Vec<&Contract> = cs.iter().copied().filter(|c| c.is_award).collect();
    let mut by_year: BTreeMap<i32, f64> = BTreeMap::new();
    for c in &aw {
        *by_year.entry(c.year).or_default() += c.amount;
    }
    let sig: Vec<Value> = db
        .signals
        .iter()
        .filter(|s| s.contract_ids.iter().any(|id| cs.iter().any(|c| c.id == *id)))
        .map(|s| signal_json(&db, s))
        .collect();
    let amounts: HashMap<i64, usize> = aw.iter().fold(HashMap::new(), |mut m, c| {
        *m.entry(c.amount.round() as i64).or_default() += 1;
        m
    });
    let repeated = amounts.iter().filter(|(_, n)| **n >= 3).map(|(a, n)| json!({ "amount": a, "times": n })).collect::<Vec<_>>();
    Json(json!({
        "key": key,
        "name": cs[0].supplier,
        "names": cs.iter().map(|c| c.supplier.clone()).collect::<std::collections::BTreeSet<_>>(),
        "total": sum(aw.iter().map(|c| c.amount)),
        "count": aw.len(),
        "direct_count": aw.iter().filter(|c| is_direct(c)).count(),
        "bodies": aw.iter().map(|c| c.body.clone()).collect::<std::collections::BTreeSet<_>>(),
        "by_year": by_year.into_iter().map(|(y, t)| json!({ "year": y, "total": t.round() })).collect::<Vec<_>>(),
        "by_category": group(aw.iter().copied(), |c| Some(c.category.clone())),
        "repeated_amounts": repeated,
        "first_date": aw.iter().filter_map(|c| c.date.clone()).min(),
        "last_date": aw.iter().filter_map(|c| c.date.clone()).max(),
        "places": group(aw.iter().copied(), |c| c.place.as_deref().map(|p| place_name(&db, p))),
        "events": group(aw.iter().copied(), |c| c.event.clone()),
        "profile": db.companies.iter().find(|p| p.key == key),
        "contracts": cs,
        "signals": sig,
    }))
    .into_response()
}

async fn events(State(db): State<Db>) -> Json<Value> {
    let list: Vec<Value> = group(awards(&db), |c| c.event.clone())
        .into_iter()
        .map(|mut e| {
            let slug = e["slug"].as_str().unwrap_or("").to_string();
            let years: std::collections::BTreeSet<i32> = awards(&db).filter(|c| c.event_slug.as_deref() == Some(&slug)).map(|c| c.year).collect();
            e["years"] = json!(years);
            e
        })
        .collect();
    Json(json!(list))
}

async fn event(State(db): State<Db>, Path(slug): Path<String>) -> Response {
    let cs: Vec<&Contract> = awards(&db).filter(|c| c.event_slug.as_deref() == Some(slug.as_str())).collect();
    if cs.is_empty() {
        return not_found("Evento");
    }
    let mut by_year: BTreeMap<i32, (f64, usize)> = BTreeMap::new();
    for c in &cs {
        let e = by_year.entry(c.year).or_default();
        e.0 += c.amount;
        e.1 += 1;
    }
    Json(json!({
        "name": cs[0].event,
        "slug": slug,
        "total": sum(cs.iter().map(|c| c.amount)),
        "count": cs.len(),
        "by_year": by_year.into_iter().map(|(y, (t, n))| json!({ "year": y, "total": t.round(), "count": n })).collect::<Vec<_>>(),
        "by_procedure": group(cs.iter().copied(), |c| Some(c.procedure_kind.clone())),
        "suppliers": group_suppliers(cs.iter().copied()).into_iter().take(10).collect::<Vec<_>>(),
        "by_category": group(cs.iter().copied(), |c| Some(c.category.clone())),
        "contracts": cs,
    }))
    .into_response()
}

fn place_stats(db: &Dataset, id: &str) -> (f64, usize, usize) {
    let cs: Vec<&Contract> = awards(db).filter(|c| c.place.as_deref() == Some(id)).collect();
    // Solo cuentan los patrones (gemelos, recurrentes); «rozando el límite» es demasiado común para marcar un lugar.
    let flagged = cs.iter().filter(|c| c.signal_ids.iter().any(|s| !s.starts_with("limite"))).count();
    (sum(cs.iter().map(|c| c.amount)), cs.len(), flagged)
}

async fn places(State(db): State<Db>) -> Json<Value> {
    let mut v: Vec<Value> = db
        .places
        .iter()
        .map(|p| {
            let (total, count, flagged) = place_stats(&db, &p.id);
            json!({ "id": p.id, "name": p.name, "kind": p.kind, "lat": p.lat, "lon": p.lon, "total": total, "count": count, "flagged": flagged })
        })
        .collect();
    v.sort_by(|a, b| b["total"].as_f64().partial_cmp(&a["total"].as_f64()).unwrap());
    Json(json!(v))
}

async fn place(State(db): State<Db>, Path(id): Path<String>) -> Response {
    let Some(p) = db.places.iter().find(|p| p.id == id) else { return not_found("Equipamiento") };
    let cs: Vec<&Contract> = awards(&db).filter(|c| c.place.as_deref() == Some(id.as_str())).collect();
    let (total, count, flagged) = place_stats(&db, &id);
    Json(json!({ "place": p, "total": total, "count": count, "flagged": flagged, "contracts": cs })).into_response()
}

#[derive(Deserialize, Default)]
struct SignalQuery {
    kind: Option<String>,
    level: Option<String>,
}

async fn signals(State(db): State<Db>, Query(q): Query<SignalQuery>) -> Json<Value> {
    let v: Vec<Value> = db
        .signals
        .iter()
        .filter(|s| q.kind.as_deref().map(|k| s.kind == k).unwrap_or(true))
        .filter(|s| q.level.as_deref().map(|l| s.level == l).unwrap_or(true))
        .map(|s| signal_json(&db, s))
        .collect();
    let counts = db.signals.iter().fold(BTreeMap::<String, usize>::new(), |mut m, s| {
        *m.entry(s.kind.clone()).or_default() += 1;
        m
    });
    Json(json!({ "counts": counts, "items": v }))
}

/// Contratos menores frente a su límite legal, agrupados por tipo de límite (servicios y suministros / obras).
async fn limits(State(db): State<Db>) -> Json<Value> {
    let groups = [(15000.0, "Servicios y suministros"), (40000.0, "Obras")];
    let out: Vec<Value> = groups
        .iter()
        .map(|(limit, name)| {
            let cs: Vec<&Contract> = awards(&db).filter(|c| c.procedure_kind == "menor" && c.limit == Some(*limit)).collect();
            let near = cs.iter().filter(|c| c.near_limit).count();
            let points: Vec<Value> = cs
                .iter()
                .map(|c| json!({ "id": c.id, "amount": c.amount, "near": c.near_limit, "twin": c.signal_ids.iter().any(|s| s.starts_with("gemelos")), "supplier": c.supplier, "description": c.description }))
                .collect();
            json!({ "name": name, "limit": limit, "count": cs.len(), "near": near, "points": points })
        })
        .collect();
    Json(json!(out))
}
