//! Fil — a dónde va el dinero de los contratos públicos de Cornellà de Llobregat.
//!
//! Uso:
//!   cargo run --release -- ingest   # descarga los contratos reales y geolocaliza equipamientos
//!   cargo run --release             # arranca la web en http://localhost:8080

mod api;
mod ingest;
mod model;
mod places;
mod text;

use std::path::PathBuf;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let root = project_root();
    let data_dir = root.join("data");
    let cmd = std::env::args().nth(1).unwrap_or_else(|| "serve".into());

    match cmd.as_str() {
        "ingest" => ingest::run(&data_dir).await,
        "serve" => {
            let dataset = model::Dataset::load(&data_dir)?;
            println!(
                "Cargados {} contratos ({}) · {} señales",
                dataset.contracts.len(),
                if dataset.is_sample { "MUESTRA" } else { "datos reales" },
                dataset.signals.len()
            );
            let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
            api::serve(Arc::new(dataset), root.join("frontend").join("dist"), port).await
        }
        other => {
            eprintln!("Comando desconocido: {other}. Usa `ingest` o `serve`.");
            std::process::exit(2);
        }
    }
}

/// Busca la raíz del proyecto (la carpeta que contiene `data/`), tanto si se
/// ejecuta desde `backend/` como desde la raíz.
fn project_root() -> PathBuf {
    if let Ok(p) = std::env::var("FIL_ROOT") {
        return PathBuf::from(p);
    }
    let cwd = std::env::current_dir().expect("cwd");
    for cand in [cwd.clone(), cwd.join(".."), cwd.join("../..")] {
        if cand.join("data").is_dir() && cand.join("backend").is_dir() {
            return cand.canonicalize().unwrap_or(cand);
        }
    }
    cwd
}
