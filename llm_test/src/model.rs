use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Informational,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct  Evidence {
    pub file: String,
    pub start_line: usize,
    pub endline: usize,
    pub snippet: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Finding {
    pub title: String,
    pub category: String,
    pub severity: Severity,
    pub description: String,
    pub attack_scenario: String,
    pub preconditions: Vec<String>,
    pub remediation: String,
    pub evidence: Vec<Evidence>,
}

impl Finding {
    pub fn validate(&self, source: &crate::source::Project) -> Result<()> {
        ensure!(
            [
                &self.title,
                &self.category,
                &self.description,
                &self.attack_scenario,
                &self.remediation
            ]
            .iter()
            .all(|s| !s.trim().is_empty()),
            "finding fields must not be empty"
        );
        ensure!(!self.evidence.is_empty(), "finding needs source evidence");
        for evidence in &self.evidence {
            ensure!(
                !evidence.snippet.trim().is_empty(),
                "empty evidence snippet"
            );
            let text = source.lines(&evidence.file, evidence.start_line, evidence.endline)?;
            ensure!(
                text.contains(&evidence.snippet),
                "evidence snippet does not match {}:{}-{}",
                evidence.file,
                evidence.start_line,
                evidence.endline
            );
        }
        Ok(())
    }
}



#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Findings {
    pub findings: Vec<Finding>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Specialist {
    pub category: String,
    pub focus: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub summary: String,
    pub entry_points: Vec<String>,
    pub specialists: Vec<Specialist>,
    pub assumptions: Vec<String>,
}

impl Plan {
    pub fn validate(&self, categories: &[String], limit: usize) -> Result<()> {
        ensure!(!self.summary.trim().is_empty(), "empty plan summary");
        ensure!(self.specialists.len() <= limit, "too many specialist tasks");
        let mut seen = BTreeSet::new();
        for task in &self.specialists {
            ensure!(
                categories.contains(&task.category),
                "unknown category {}",
                task.category
            );
            ensure!(
                !task.focus.trim().is_empty() && seen.insert(&task.category),
                "empty or duplicate specialist task"
            );
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[allow(non_camel_case_types)]
pub enum Verdict {
    Accepted,
    Rejected,
    Need_more_evidence, //variant: should be NeedMoreEvidence 
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub verdict: Verdict,
    pub confidence: u8,
    pub rationale: String,
    pub evidence: Vec<Evidence>,
}


#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Candidate {
    pub id: String,
    pub finding: Finding,
    pub discovered_by: Vec<String>,
    pub review: Option<Review>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskSummary {
    pub id: String,
    pub status: String,
    pub cached: bool,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Report {
    pub schema_version: u32,
    pub run_id: String,
    pub status: String,
    pub project: String,
    pub source_hash: String,
    pub threat_model: String,
    pub models: Vec<String>,
    pub files: usize,
    pub knowledge_documents: usize,
    pub requests_this_run: usize,
    pub warnings: Vec<String>,
    pub tasks: Vec<TaskSummary>,
    pub candidates: Vec<Candidate>,
}


// should now every ensure means what