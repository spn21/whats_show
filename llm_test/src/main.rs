use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use llm_test::{
    agent::AgentRunner,
    config::Config,
    knowledge::Knowledge,
    llm::HttpModel,
    model::Verdict,
    pipeline,
    source::Project,
    storage::{Store, timestamp},
    tools::Toolbox,
};
use std::{path::PathBuf, sync::Arc};

#[derive(Parser)]
#[command(
    version,
    about = "Rust 多 Agent Solidity 漏洞检测：规划、专项分析、独立复核"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 查看 AST 索引和扫描范围
    Inspect {
        #[arg(long)]
        project: PathBuf,
        #[arg(long)]
        config: Option<PathBuf>,
        #[arg(long)]
        output: Option<PathBuf>,
    },
    ///cluster_knowlegde and divide into chunk
    Knowledge {
        #[arg(long)]
        name: Option<String>,
        #[arg(long, default_value_t = 0)]
        offset: usize,
        #[arg(long, default_value_t = 3000)]
        limit: usize,
    },
    /// create task 
    Scan {
        #[arg(long)]
        project: PathBuf,
        #[arg(long)]
        config: Option<PathBuf>,
        #[arg(long, default_value = "output")]
        output: PathBuf,
        #[arg(long)]
        run_id: Option<String>,
        #[arg(long, requires = "run_id")]
        resume: bool,
    },
}

fn load_config(path: Option<PathBuf>) -> Result<Config> {
    match path {
        Some(p) => Config::load(&p),
        None => {
            let c = Config::default();
            c.validate()?;
            Ok(c)
        }
    }
}

#[tokio::main]
async fn main() -> std::process::ExitCode {
    match run().await {
        Ok(code) => std::process::ExitCode::from(code),
        Err(error) => {
            eprintln!("error: {error:#}");
            std::process::ExitCode::from(1)
        }
    }
}

async fn run() -> Result<u8> {
    match Cli::parse().command {
        Command::Knowledge {
            name,
            offset,
            limit,
        } => {
            let knowledge = Knowledge::embedded()?;
            let value = match name {
                Some(n) => knowledge.read(&n, offset, limit)?,
                None => knowledge.catalog(),
            };
            println!("{}", serde_json::to_string_pretty(&value)?);
            Ok(0)
        }
        Command::Inspect {
            project,
            config,
            output,
        } => {
            let config = load_config(config)?;
            let project = Project::load(&project, &config)?;
            let value = serde_json::json!({"source_hash":project.hash,"scope":project.overview(),"index":project.files});
            if let Some(path) = output {
                llm_test::storage::atomic_json(&path, &value)?;
                eprintln!("Index written to {}", path.display());
            } else {
                println!("{}", serde_json::to_string_pretty(&value)?);
            }
            Ok(if project.failures.is_empty() { 0 } else { 2 })
        }
        Command::Scan {
            project,
            config,
            output,
            run_id,
            resume,
        } => {
            let config = load_config(config)?;
            let project = Arc::new(Project::load(&project, &config)?);
            let knowledge = Arc::new(Knowledge::embedded()?);
            let key = std::env::var(&config.api_key_env)
                .with_context(|| format!("set {} to your provider API key", config.api_key_env))?;
            let model = Arc::new(HttpModel::new(config.clone(), key)?);
            let runner = AgentRunner {
                model,
                tools: Toolbox {
                    project,
                    knowledge,
                    max_chars: config.max_tool_chars,
                },
                config,
            };
            let fingerprint = pipeline::fingerprint(&runner)?;
            let run_id =
                run_id.unwrap_or_else(|| format!("scan-{}-{}", timestamp(), std::process::id()));
            let store = Arc::new(Store::open(&output, &run_id, resume, &fingerprint)?);
            let report = pipeline::scan(runner, store.clone()).await?;
            let accepted = report
                .candidates
                .iter()
                .filter(|c| {
                    c.review
                        .as_ref()
                        .is_some_and(|r| r.verdict == Verdict::Accepted)
                })
                .count();
            println!(
                "Status: {} | candidates: {} | accepted by LLM review: {}\nReport: {}\nCheckpoint: {}",
                report.status,
                report.candidates.len(),
                accepted,
                store.dir.join("report.md").display(),
                store.dir.join("events.jsonl").display()
            );
            Ok(if report.status == "completed" { 0 } else { 2 })
        }
    }
}
