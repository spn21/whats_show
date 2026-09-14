use crate::config::Config;
use anyhow::{Context, Result, bail, ensure};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::sync::Semaphore;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub function: ToolFunction,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}
impl Message {
    pub fn new(role: &str, content: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }
}
#[derive(Clone, Debug)]
pub struct Completion {
    pub message: Message,
    pub finish_reason: String,
}

#[async_trait]
pub trait ChatModel: Send + Sync {
    async fn complete(
        &self,
        model: &str,
        messages: &[Message],
        tools: &[Value],
    ) -> Result<Completion>;
    fn request_count(&self) -> usize;
}

pub struct HttpModel {
    client: reqwest::Client,
    config: Config,
    key: String,
    semaphore: Arc<Semaphore>,
    requests: AtomicUsize,
}
impl HttpModel {
    pub fn new(config: Config, key: String) -> Result<Self> {
        config.validate()?;
        ensure!(!key.trim().is_empty(), "empty API key");
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(config.request_timeout_secs))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(Self {
            client,
            semaphore: Arc::new(Semaphore::new(config.concurrency)),
            config,
            key,
            requests: AtomicUsize::new(0),
        })
    }
}

#[async_trait]
impl ChatModel for HttpModel {
    async fn complete(
        &self,
        model: &str,
        messages: &[Message],
        tools: &[Value],
    ) -> Result<Completion> {
        let mut body = json!({"model":model,"messages":messages,"temperature":0,"max_tokens":self.config.max_output_tokens,"tools":tools,"tool_choice":"auto","stream":false});
        if self.config.json_mode {
            body["response_format"] = json!({"type":"json_object"});
        }
        for attempt in 0..=self.config.http_retries {
            let permit = self.semaphore.acquire().await?;
            self.requests
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
                    (n < self.config.max_requests).then_some(n + 1)
                })
                .map_err(|_| anyhow::anyhow!("global HTTP request budget exhausted"))?;
            let response = self
                .client
                .post(format!(
                    "{}/chat/completions",
                    self.config.base_url.trim_end_matches('/')
                ))
                .bearer_auth(&self.key)
                .json(&body)
                .send()
                .await;
            match response {
                Ok(mut response) => {
                    let status = response.status();
                    if status.is_success() {
                        let mut bytes = Vec::new();
                        while let Some(chunk) = response
                            .chunk()
                            .await
                            .context("reading LLM response failed")?
                        {
                            ensure!(
                                bytes.len() + chunk.len() <= 8_000_000,
                                "LLM response exceeds 8 MB limit"
                            );
                            bytes.extend(chunk);
                        }
                        let value: Value = serde_json::from_slice(&bytes)
                            .context("LLM endpoint returned invalid JSON")?;
                        let choice = value["choices"]
                            .as_array()
                            .and_then(|a| a.first())
                            .context("LLM returned no choices")?;
                        let finish_reason = choice["finish_reason"]
                            .as_str()
                            .context("LLM missing finish_reason")?
                            .to_owned();
                        let message: Message = serde_json::from_value(choice["message"].clone())
                            .context("invalid assistant message")?;
                        ensure!(message.role == "assistant", "expected assistant message");
                        return Ok(Completion {
                            message,
                            finish_reason,
                        });
                    }
                    if !(status.as_u16() == 429 || status.is_server_error())
                        || attempt == self.config.http_retries
                    {
                        // Provider bodies may echo credentials or source. Keep persisted errors sanitized.
                        bail!(
                            "LLM HTTP status {} (response body omitted)",
                            status.as_u16()
                        );
                    }
                }
                Err(error) => {
                    if attempt == self.config.http_retries
                        || !(error.is_timeout() || error.is_connect() || error.is_request())
                    {
                        bail!(
                            "LLM transport failed (timeout={}, connect={})",
                            error.is_timeout(),
                            error.is_connect()
                        );
                    }
                }
            }
            drop(permit);
            tokio::time::sleep(Duration::from_millis(250 * (1_u64 << attempt))).await;
        }
        bail!("HTTP retry budget exhausted")
    }
    fn request_count(&self) -> usize {
        self.requests.load(Ordering::SeqCst)
    }
}
