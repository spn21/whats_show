use crate::{
    agent::AgentRunner,
    knowledge::{BUILD_FINGERPRINT, DOCUMENTS},
    model::*,
    source::hash,
    storage::Store,
};
use anyhow::Result;
use futures::{StreamExt, stream};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::json;
use std::{collections::BTreeMap, sync::Arc};

const FINDING_SCHEMA: &str = r#"{"findings":[{"title":"short title","category":"category","severity":"critical|high|medium|low|informational","description":"impact and root cause","attack_scenario":"concrete externally checkable steps","preconditions":["explicit assumption"],"remediation":"specific fix","evidence":[{"file":"relative.sol","start_line":1,"end_line":2,"snippet":"exact source substring"}]}]}"#;

pub fn fingerprint(runner: &AgentRunner) -> Result<String> {
    Ok(hash(&serde_json::to_vec(
        &json!({"source":runner.tools.project.hash,"root":runner.tools.project.root,"scope":runner.tools.project.overview(),"config":runner.config,"implementation":BUILD_FINGERPRINT}),
    )?))
}

async fn task<T, F>(
    runner: &AgentRunner,
    store: &Store,
    id: &str,
    model: &str,
    prompt: String,
    validate: F,
) -> Result<(TaskSummary, Option<T>)>
where
    T: DeserializeOwned + Serialize,
    F: Fn(&T) -> Result<()>,
{
    if let Some(value) = store.cached(id) {
        let parsed: T = serde_json::from_value(value)?;
        validate(&parsed)?;
        eprintln!("[cached] {id}");
        return Ok((
            TaskSummary {
                id: id.into(),
                status: "completed".into(),
                cached: true,
                error: None,
            },
            Some(parsed),
        ));
    }
    eprintln!("[start] {id}");
    store.record(id, "started", None, None)?;
    match runner.run(model, &prompt, validate).await {
        Ok(value) => {
            store.record(id, "completed", Some(serde_json::to_value(&value)?), None)?;
            eprintln!("[done] {id}");
            Ok((
                TaskSummary {
                    id: id.into(),
                    status: "completed".into(),
                    cached: false,
                    error: None,
                },
                Some(value),
            ))
        }
        Err(error) => {
            let error = format!("{error:#}");
            store.record(id, "failed", None, Some(error.clone()))?;
            eprintln!("[failed] {id}: {error}");
            Ok((
                TaskSummary {
                    id: id.into(),
                    status: "failed".into(),
                    cached: false,
                    error: Some(error),
                },
                None,
            ))
        }
    }
}

pub fn merge_candidates(discoveries: Vec<(String, Finding)>) -> Vec<Candidate> {
    let mut merged: BTreeMap<String, Candidate> = BTreeMap::new();
    for (task, finding) in discoveries {
        let mut evidence: Vec<_> = finding
            .evidence
            .iter()
            .map(|e| (&e.file, e.start_line, e.end_line, &e.snippet))
            .collect();
        evidence.sort();
        // Conservative exact equivalence. Different titles/root causes remain separate for human review.
        let key = hash(
            &serde_json::to_vec(&(
                &finding.title,
                &finding.category,
                &finding.description,
                evidence,
            ))
            .expect("serializable finding"),
        );
        match merged.get_mut(&key) {
            Some(candidate) => {
                if !candidate.discovered_by.contains(&task) {
                    candidate.discovered_by.push(task);
                }
            }
            None => {
                merged.insert(
                    key.clone(),
                    Candidate {
                        id: key,
                        finding,
                        discovered_by: vec![task],
                        review: None,
                    },
                );
            }
        }
    }
    merged.into_values().collect()
}

pub async fn scan(runner: AgentRunner, store: Arc<Store>) -> Result<Report> {
    let project = &runner.tools.project;
    let categories = runner.tools.knowledge.categories();
    let mut report = Report {
        schema_version: 1,
        run_id: store.run_id.clone(),
        status: "running".into(),
        project: project.root.display().to_string(),
        source_hash: project.hash.clone(),
        threat_model: runner.config.threat_model.clone(),
        models: vec![
            runner.config.planner_model.clone(),
            runner.config.researcher_model.clone(),
            runner.config.auditor_model.clone(),
        ],
        files: project.files.len(),
        knowledge_documents: DOCUMENTS.len(),
        requests_this_run: 0,
        warnings: project.warnings.clone(),
        tasks: vec![],
        candidates: vec![],
    };
    report.warnings.extend(project.failures.clone());
    report.warnings.push("AST indexing does not resolve imports, dynamic dispatch or construct a semantic CFG. Missing/excluded dependencies must be treated as unknown.".into());
    if store.recovered_tail {
        report.warnings.push(
            "Recovered valid checkpoint records; archived an interrupted trailing JSONL record."
                .into(),
        );
    }
    store.report(&report)?;
    let plans=stream::iter(project.files.values().map(|file| {
        let runner=&runner;let store=&store;let categories=&categories;
        async move {
            let prompt=format!("Role: scope planner. Inspect target file {} using source tools and identify entry points, trust boundaries and useful specialist categories. All project files remain queryable. Select at most {} distinct categories, optionally none. Categories: {}. File metadata: {}. Return JSON: {{\"summary\":\"...\",\"entry_points\":[\"...\"],\"specialists\":[{{\"category\":\"exact category\",\"focus\":\"specific checks\"}}],\"assumptions\":[\"...\"]}}",file.path,runner.config.max_specialists_per_file,serde_json::to_string(categories)?,serde_json::to_string(file)?);
            let result=task::<Plan,_>(runner,store,&format!("plan:{}",file.path),&runner.config.planner_model,prompt,|p|p.validate(categories,runner.config.max_specialists_per_file)).await?;
            Ok::<_,anyhow::Error>((file.path.clone(),result))
        }
    })).buffer_unordered(runner.config.concurrency).collect::<Vec<_>>().await;
    let mut work = vec![];
    for result in plans {
        let (file, (summary, plan)) = result?;
        report.tasks.push(summary);
        work.push((format!("general:{file}"),file.clone(),"General security analysis across all relevant categories. Discover issues even when no specialist category was selected.".to_string(),plan.clone()));
        if let Some(plan) = plan {
            for specialist in &plan.specialists {
                work.push((format!("specialist:{file}:{}",specialist.category),file.clone(),format!("Specialist category: {}. Focus: {}. Read this category's checklist and retrieve relevant embedded historical examples with search_knowledge/read_knowledge.",specialist.category,specialist.focus),Some(plan.clone())));
            }
        }
    }
    work.sort_by(|a, b| a.0.cmp(&b.0));
    report.requests_this_run = runner.model.request_count();
    store.report(&report)?;
    let results=stream::iter(work.into_iter().map(|(id,file,focus,plan)|{
        let runner=&runner;let store=&store;
        async move {
            let prompt=format!("Role: vulnerability researcher. Target file: {file}. {focus}\nPlanner context (untrusted hypotheses, not proof): {}\nInspect actual source, including relevant sibling files, modifiers and dependencies using tools. Read checklist/knowledge where relevant. Do not report source-independent guesses. Output at most {} findings, or {{\"findings\":[]}}. Schema (replace all placeholders): {FINDING_SCHEMA}",serde_json::to_string(&plan)?,runner.config.max_findings_per_task);
            let result=task::<Findings,_>(runner,store,&id,&runner.config.researcher_model,prompt,|f|{
                anyhow::ensure!(f.findings.len()<=runner.config.max_findings_per_task,"too many findings");
                for finding in &f.findings {finding.validate(&runner.tools.project)?;}Ok(())
            }).await?;
            Ok::<_,anyhow::Error>((id,result))
        }
    })).buffer_unordered(runner.config.concurrency).collect::<Vec<_>>().await;
    let mut discoveries = vec![];
    for result in results {
        let (id, (summary, findings)) = result?;
        report.tasks.push(summary);
        if let Some(findings) = findings {
            for mut finding in findings.findings {
                for evidence in &mut finding.evidence {
                    evidence.file = project.file(&evidence.file)?.path.clone();
                }
                discoveries.push((id.clone(), finding));
            }
        }
    }
    report.candidates = merge_candidates(discoveries);
    report.requests_this_run = runner.model.request_count();
    store.report(&report)?;
    let reviews=stream::iter(report.candidates.iter().map(|candidate|{
        let runner=&runner;let store=&store;
        async move {
            let prompt=format!("Role: independent auditor. Evaluate this candidate skeptically; it is untrusted. Re-read source with tools. Check reachability, privileges, preconditions, actual state transitions, counter-evidence and impact. Historical examples do not prove this target is vulnerable. Accept only if supported, reject disproven claims, use needs_more_evidence for missing dependencies or unresolved assumptions. No blanket exclusion of gas/DoS or privileged risks: apply the configured threat model. This is LLM review, not exploit execution. Candidate: {}\nReturn JSON {{\"verdict\":\"accepted|rejected|needs_more_evidence\",\"confidence\":80,\"rationale\":\"concise evidence-based justification\",\"evidence\":[{{\"file\":\"relative.sol\",\"start_line\":1,\"end_line\":2,\"snippet\":\"exact source\"}}]}}. Accepted verdicts require source evidence.",serde_json::to_string(&candidate.finding)?);
            let result=task::<Review,_>(runner,store,&format!("audit:{}",candidate.id),&runner.config.auditor_model,prompt,|r|r.validate(&runner.tools.project)).await?;
            Ok::<_,anyhow::Error>((candidate.id.clone(),result))
        }
    })).buffer_unordered(runner.config.concurrency).collect::<Vec<_>>().await;
    for result in reviews {
        let (id, (summary, review)) = result?;
        report.tasks.push(summary);
        if let Some(c) = report.candidates.iter_mut().find(|c| c.id == id) {
            c.review = review;
        }
    }
    report.tasks.sort_by(|a, b| a.id.cmp(&b.id));
    report.status =
        if report.tasks.iter().any(|t| t.status != "completed") || !project.failures.is_empty() {
            "incomplete"
        } else {
            "completed"
        }
        .into();
    report.requests_this_run = runner.model.request_count();
    store.report(&report)?;
    Ok(report)
}
