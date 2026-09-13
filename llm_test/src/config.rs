use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    pub base_url: String,
    pub api_key_env: String,
    pub planner_model: String,
    pub researcher_model: String,
    pub auditor_model: String,
    pub concurrency: usize,
    pub request_timeout_secs: u64,
    pub task_timeout_secs: u64,
    pub max_requests: usize,
    pub max_tool_rounds: usize,
    pub max_output_tokens: usize,
    pub max_context_chars: usize,
    pub max_tool_chars: usize,
    pub max_file_bytes: usize,
    pub max_project_bytes: usize,
    pub max_specialists_per_file: usize,
    pub max_findings_per_task: usize,
    pub http_retries: usize,
    pub format_retries: usize,
    pub json_mode: bool,
    pub exclude_dirs: Vec<String>,
    pub threat_model: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: "https://api.deepseek.com/v1".into(),
            api_key_env: "LLM_API_KEY".into(),
            planner_model: "deepseek-chat".into(),
            researcher_model: "deepseek-chat".into(),
            auditor_model: "deepseek-chat".into(),
            concurrency: 3, request_timeout_secs: 120, task_timeout_secs: 900,
            max_requests: 300, max_tool_rounds: 12, max_output_tokens: 4096,
            max_context_chars: 160_000, max_tool_chars: 24_000,
            max_file_bytes: 1_000_000, max_project_bytes: 20_000_000,
            max_specialists_per_file: 2, max_findings_per_task: 20,
            http_retries: 2, format_retries: 2, json_mode: false,
            exclude_dirs: vec![".git".into(), "node_modules".into(), "out".into(), "cache".into(), "target".into(), "test".into(), "tests".into()],
            threat_model: "Untrusted external callers and adversarial external contracts. Check access control, reentrancy, accounting, oracle manipulation, signatures and denial of service. State deployment assumptions explicitly. Do not assume missing dependency implementations are either safe or vulnerable.".into(),
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let config: Self = toml::from_str(
            &std::fs::read_to_string(path)
                .with_context(|| format!("cannot read config {}", path.display()))?,
        )?;
        config.validate()?;
        Ok(config)
    }
    pub fn validate(&self) -> Result<()> {
        let url = reqwest::Url::parse(&self.base_url).context("invalid base_url")?;
        ensure!(
            matches!(url.scheme(), "http" | "https"),
            "base_url must use http(s)"
        );
        ensure!(
            url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none(),
            "base_url must not contain credentials, query or fragment"
        );
        for (name, value) in [
            ("concurrency", self.concurrency),
            ("max_requests", self.max_requests),
            ("max_tool_rounds", self.max_tool_rounds),
            ("max_output_tokens", self.max_output_tokens),
            ("max_findings_per_task", self.max_findings_per_task),
        ] {
            ensure!(value > 0, "{name} must be positive");
        }
        ensure!(
            self.request_timeout_secs > 0 && self.task_timeout_secs > 0,
            "timeouts must be positive"
        );
        ensure!(
            self.max_tool_chars >= 1000 && self.max_context_chars >= self.max_tool_chars * 2,
            "context/tool budgets are too small"
        );
        ensure!(
            self.max_file_bytes > 0 && self.max_project_bytes >= self.max_file_bytes,
            "invalid source size limits"
        );
        ensure!(
            self.http_retries <= 5
                && self.format_retries <= 5
                && self.max_specialists_per_file <= 8,
            "retry/specialist limits exceeded"
        );
        ensure!(
            [
                &self.planner_model,
                &self.researcher_model,
                &self.auditor_model,
                &self.api_key_env
            ]
            .iter()
            .all(|s| !s.trim().is_empty()),
            "model names and key environment variable must be nonempty"
        );
        Ok(())
    }
}
