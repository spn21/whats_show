use crate::model::{Report, Verdict};
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

pub fn timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

#[derive(Serialize, Deserialize)]
struct Record {
    task_id: String,
    status: String,
    timestamp_ns: u128,
    result: Option<Value>,
    error: Option<String>,
}

pub struct Store {
    pub dir: PathBuf,
    pub run_id: String,
    pub recovered_tail: bool,
    cache: BTreeMap<String, Value>,
    log: Mutex<File>,
    lock: PathBuf,
}

struct LockGuard(PathBuf);
impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

impl Store {
    pub fn open(output: &Path, run_id: &str, resume: bool, fingerprint: &str) -> Result<Self> {
        ensure!(
            !run_id.is_empty()
                && run_id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_')),
            "run id accepts only letters, numbers, - and _"
        );
        fs::create_dir_all(output)?;
        let dir = output.join(run_id);
        if resume {
            ensure!(dir.is_dir(), "resume run does not exist");
        } else {
            fs::create_dir(&dir)
                .context("run directory already exists; use --resume or a new --run-id")?;
        }
        let lock = dir.join("run.lock");
        let mut lockfile=OpenOptions::new().write(true).create_new(true).open(&lock)
            .context("run is locked; if a previous process crashed, verify it is stopped before removing run.lock")?;
        let guard = LockGuard(lock.clone());
        writeln!(lockfile, "pid={}", std::process::id())?;
        let manifest = dir.join("manifest.json");
        if resume {
            let value: Value = serde_json::from_reader(File::open(&manifest)?)?;
            ensure!(
                value["fingerprint"].as_str() == Some(fingerprint),
                "resume rejected: source, config, knowledge or scanner implementation changed"
            );
        } else {
            atomic_json(
                &manifest,
                &serde_json::json!({"fingerprint":fingerprint,"run_id":run_id,"schema_version":1}),
            )?;
        }
        let logpath = dir.join("events.jsonl");
        let mut previous = String::new();
        if logpath.exists() {
            File::open(&logpath)?.read_to_string(&mut previous)?;
        }
        let mut cache = BTreeMap::new();
        let mut recovered_tail = false;
        let lines: Vec<_> = previous.split_inclusive('\n').collect();
        for (i, line) in lines.iter().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let record: Record = match serde_json::from_str(line) {
                Ok(record) => record,
                Err(_) if i + 1 == lines.len() && !line.ends_with('\n') => {
                    recovered_tail = true;
                    break;
                }
                Err(error) => {
                    return Err(error)
                        .context("corrupt checkpoint record; refusing to silently drop history");
                }
            };
            if record.status == "completed" {
                if let Some(result) = record.result {
                    cache.insert(record.task_id, result);
                }
            } else {
                cache.remove(&record.task_id);
            }
        }
        if recovered_tail {
            // Preserve the torn tail and start a fresh valid log, keeping completed records.
            fs::rename(
                &logpath,
                dir.join(format!("events-interrupted-{}.jsonl", timestamp())),
            )?;
            let mut repaired = File::create(&logpath)?;
            for line in lines.iter().take(lines.len() - 1) {
                repaired.write_all(line.as_bytes())?;
            }
            repaired.sync_all()?;
        }
        let mut log = OpenOptions::new().create(true).append(true).open(logpath)?;
        if !recovered_tail && !previous.is_empty() && !previous.ends_with('\n') {
            writeln!(log)?;
        }
        std::mem::forget(guard);
        Ok(Self {
            dir,
            run_id: run_id.into(),
            recovered_tail,
            cache,
            log: Mutex::new(log),
            lock,
        })
    }
    pub fn cached(&self, id: &str) -> Option<Value> {
        self.cache.get(id).cloned()
    }
    pub fn record(
        &self,
        id: &str,
        status: &str,
        result: Option<Value>,
        error: Option<String>,
    ) -> Result<()> {
        let mut bytes = serde_json::to_vec(&Record {
            task_id: id.into(),
            status: status.into(),
            timestamp_ns: timestamp(),
            result,
            error,
        })?;
        bytes.push(b'\n');
        let mut log = self
            .log
            .lock()
            .map_err(|_| anyhow::anyhow!("checkpoint lock poisoned"))?;
        log.write_all(&bytes)?;
        log.sync_data()?;
        Ok(())
    }
    pub fn report(&self, report: &Report) -> Result<()> {
        atomic_json(
            &self.dir.join(format!("report-{}.json", timestamp())),
            report,
        )?;
        atomic_json(&self.dir.join("report.json"), report)?;
        atomic_write(&self.dir.join("report.md"), markdown(report).as_bytes())
    }
}
impl Drop for Store {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.lock);
    }
}

pub fn atomic_json(path: &Path, value: &impl Serialize) -> Result<()> {
    atomic_write(path, &serde_json::to_vec_pretty(value)?)
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let temporary = path.with_extension(format!("tmp-{}-{}", std::process::id(), timestamp()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(temporary, path)?;
    Ok(())
}

pub fn markdown(report: &Report) -> String {
    let accepted = report
        .candidates
        .iter()
        .filter(|c| {
            c.review
                .as_ref()
                .is_some_and(|r| r.verdict == Verdict::Accepted)
        })
        .count();
    let mut out = format!(
        "# Solidity audit report\n\nRun: `{}`\n\nStatus: **{}**\n\nFiles: {} | Candidates: {} | Accepted by LLM review: {} | HTTP requests this invocation: {}\n\nLLM review is not an executed exploit proof. Zero accepted findings does not establish safety. Coverage is limited to the listed scope and completed tasks.\n\n## Threat model\n\n{}\n\n## Scope and warnings\n\n",
        report.run_id,
        report.status,
        report.files,
        report.candidates.len(),
        accepted,
        report.requests_this_run,
        report.threat_model
    );
    for warning in &report.warnings {
        out.push_str(&format!("- {warning}\n"));
    }
    out.push_str("\n## Tasks\n\n| Task | Status | Cached |\n|---|---|---|\n");
    for task in &report.tasks {
        out.push_str(&format!(
            "| {} | {} | {} |\n",
            task.id.replace('|', "\\|"),
            task.status,
            task.cached
        ));
    }
    for task in &report.tasks {
        if let Some(error) = &task.error {
            out.push_str(&format!("\nTask `{}` failed: {}\n", task.id, error));
        }
    }
    for candidate in &report.candidates {
        let f = &candidate.finding;
        out.push_str(&format!("\n## {:?}: {}\n\nID: `{}`\n\nCategory: {}\n\n{}\n\n### Attack scenario\n\n{}\n\n### Preconditions\n\n{}\n\n### Remediation\n\n{}\n\n### Review\n\n",f.severity,f.title,candidate.id,f.category,f.description,f.attack_scenario,f.preconditions.join("\n"),f.remediation));
        match &candidate.review {
            Some(r) => out.push_str(&format!(
                "Verdict: {:?}; confidence: {} / 100\n\n{}\n",
                r.verdict, r.confidence, r.rationale
            )),
            None => out.push_str("Review did not complete.\n"),
        }
        out.push_str("\n### Source evidence\n\n");
        for e in &f.evidence {
            out.push_str(&format!("{}:{}-{}\n\n", e.file, e.start_line, e.end_line));
            for line in e.snippet.lines() {
                out.push_str(&format!("    {line}\n"));
            }
            out.push('\n');
        }
        if let Some(r) = &candidate.review {
            out.push_str("\n### Reviewer evidence\n\n");
            for e in &r.evidence {
                out.push_str(&format!("{}:{}-{}\n\n", e.file, e.start_line, e.end_line));
                for line in e.snippet.lines() {
                    out.push_str(&format!("    {line}\n"));
                }
            }
        }
    }
    out
}
