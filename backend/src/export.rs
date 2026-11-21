//! Exporta todas las respuestas de la API como archivos JSON estáticos, para
//! publicar la web sin servidor (por ejemplo en Vercel).
//!
//!   cargo run --release -- export      → frontend/public/data/

use crate::api;
use crate::model::Dataset;
use crate::text;
use axum::body::Body;
use axum::http::Request;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use tower::ServiceExt;

pub async fn run(dataset: Dataset, out: &Path) -> anyhow::Result<()> {
    let db = Arc::new(dataset);
    if out.exists() {
        std::fs::remove_dir_all(out)?;
    }
    std::fs::create_dir_all(out)?;

    let mut urls: Vec<(String, String)> = vec![
        ("/api/meta".into(), "meta.json".into()),
        ("/api/summary".into(), "summary.json".into()),
        ("/api/categories".into(), "categories.json".into()),
        ("/api/suppliers".into(), "suppliers.json".into()),
        ("/api/events".into(), "events.json".into()),
        ("/api/places".into(), "places.json".into()),
        ("/api/limits".into(), "limits.json".into()),
        ("/api/signals".into(), "signals.json".into()),
    ];
    for kind in ["gemelos", "limite", "recurrente"] {
        urls.push((format!("/api/signals?kind={kind}"), format!("signals/{kind}.json")));
    }
    let mut cats: Vec<String> = db.contracts.iter().filter(|c| c.is_award).map(|c| text::slug(&c.category)).collect();
    cats.sort();
    cats.dedup();
    for s in cats {
        urls.push((format!("/api/categories/{s}"), format!("categories/{s}.json")));
    }
    let mut keys: Vec<String> = db.contracts.iter().map(|c| c.supplier_key.clone()).collect();
    keys.sort();
    keys.dedup();
    for k in keys {
        urls.push((format!("/api/suppliers/{k}"), format!("suppliers/{k}.json")));
    }
    let mut evs: Vec<String> = db.contracts.iter().filter(|c| c.is_award).filter_map(|c| c.event_slug.clone()).collect();
    evs.sort();
    evs.dedup();
    for e in evs {
        urls.push((format!("/api/events/{e}"), format!("events/{e}.json")));
    }
    for p in &db.places {
        urls.push((format!("/api/places/{}", p.id), format!("places/{}.json", p.id)));
    }
    for c in &db.contracts {
        urls.push((format!("/api/contracts/{}", c.id), format!("contracts/{}.json", c.id)));
    }

    let app = api::router(db.clone());
    for (url, file) in &urls {
        let res = app.clone().oneshot(Request::get(url.as_str()).body(Body::empty())?).await?;
        if !res.status().is_success() {
            anyhow::bail!("{url} respondió {}", res.status());
        }
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await?;
        let path = out.join(file);
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(path, bytes)?;
    }

    // Todos los contratos en un archivo, con los slugs ya calculados para filtrar en el navegador.
    let all: Vec<Value> = db
        .contracts
        .iter()
        .map(|c| {
            let mut v = serde_json::to_value(c).unwrap_or(Value::Null);
            v["category_slug"] = json!(text::slug(&c.category));
            v["body_slug"] = json!(text::slug(&c.body));
            v["search"] = json!(text::fold(&format!("{} {} {}", c.description, c.supplier, c.event.as_deref().unwrap_or(""))));
            v
        })
        .collect();
    std::fs::write(out.join("contracts.json"), serde_json::to_vec(&all)?)?;

    println!("Exportados {} archivos en {}", urls.len() + 1, out.display());
    Ok(())
}
