//! Descarga los contratos del Registre Públic de Contractes (datos abiertos del
//! Consorci AOC) y geolocaliza los equipamientos con OpenStreetMap.

use crate::model::{ENS_AJ, ENS_PRO};
use crate::places::{self, Geo};
use crate::text;
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;

const API: &str = "https://dadesobertes.seu-e.cat/api/3/action/datastore_search";
const RESOURCE: &str = "1c15c6fa-2134-4e8b-a230-66c59278a9d6";
const PAGE: usize = 1000;
const UA: &str = "fil-cornella/0.1 (proyecto personal de transparencia)";

pub async fn run(data_dir: &Path) -> anyhow::Result<()> {
    std::fs::create_dir_all(data_dir)?;
    let client = reqwest::Client::builder()
        .user_agent(UA)
        .timeout(Duration::from_secs(60))
        .build()?;

    let mut all: Vec<Value> = Vec::new();
    for org in [ENS_AJ, ENS_PRO] {
        let filters = serde_json::json!({ "ORGANISME_CONTRACTANT": org }).to_string();
        let mut offset = 0;
        loop {
            let resp: Value = client
                .get(API)
                .query(&[
                    ("resource_id", RESOURCE),
                    ("filters", filters.as_str()),
                    ("limit", &PAGE.to_string()),
                    ("offset", &offset.to_string()),
                ])
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            let result = &resp["result"];
            let records = result["records"].as_array().cloned().unwrap_or_default();
            let total = result["total"].as_u64().unwrap_or(0) as usize;
            let n = records.len();
            all.extend(records);
            offset += n;
            println!("{org}: {offset}/{total}");
            if n == 0 || offset >= total {
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
    let raw_path = data_dir.join("raw.json");
    std::fs::write(&raw_path, serde_json::to_string(&all)?)?;
    println!("Guardados {} registros en {}", all.len(), raw_path.display());

    geocode(&client, data_dir, &all).await?;
    println!("Listo. Arranca la web con `cargo run --release`.");
    Ok(())
}

async fn geocode(client: &reqwest::Client, data_dir: &Path, raw: &[Value]) -> anyhow::Result<()> {
    let path = data_dir.join("places.json");
    let mut cache: Vec<Geo> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let have: HashSet<String> = cache.iter().map(|g| g.id.clone()).collect();

    let mut needed = HashSet::new();
    for r in raw {
        let d = r["DESCRIPCIO_EXPEDIENT"].as_str().unwrap_or("");
        if let Some(p) = places::detect(&text::fold(&text::clean(d))) {
            needed.insert(p.id);
        }
    }
    for p in places::PLACES.iter().filter(|p| needed.contains(p.id) && !have.contains(p.id)) {
        let resp: Value = client
            .get("https://nominatim.openstreetmap.org/search")
            .query(&[("q", p.query), ("format", "json"), ("limit", "1"), ("countrycodes", "es")])
            .send()
            .await?
            .json()
            .await
            .unwrap_or(Value::Null);
        if let Some(hit) = resp.as_array().and_then(|a| a.first()) {
            let lat = hit["lat"].as_str().and_then(|s| s.parse().ok());
            let lon = hit["lon"].as_str().and_then(|s| s.parse().ok());
            if let (Some(lat), Some(lon)) = (lat, lon) {
                // Solo aceptamos resultados dentro de Cornellà (caja aproximada del término municipal).
                if (41.33..=41.375).contains(&lat) && (2.05..=2.11).contains(&lon) {
                    println!("+ {} -> {lat:.5}, {lon:.5}", p.name);
                    cache.push(Geo { id: p.id.into(), lat, lon });
                } else {
                    println!("· {} fuera de Cornellà, se ignora", p.name);
                }
            }
        } else {
            println!("· {} sin resultado en OpenStreetMap", p.name);
        }
        // Política de uso de Nominatim: como máximo una petición por segundo.
        tokio::time::sleep(Duration::from_millis(1100)).await;
    }
    std::fs::write(&path, serde_json::to_string_pretty(&cache)?)?;
    Ok(())
}
