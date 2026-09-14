use crate::{knowledge::Knowledge, source::Project};
use anyhow::{Context, Result, bail, ensure};
use serde_json::{Value, json};
use std::sync::Arc;

#[derive(Clone)]
pub struct Toolbox {
    pub project: Arc<Project>,
    pub knowledge: Arc<Knowledge>,
    pub max_chars: usize,
}

fn definition(name: &str, description: &str, properties: Value, required: &[&str]) -> Value {
    json!({"type":"function","function":{"name":name,"description":description,"parameters":{"type":"object","properties":properties,"required":required,"additionalProperties":false}}})
}
pub fn definitions() -> Vec<Value> {
    vec![
        definition(
            "list_files",
            "List indexed Solidity files, imports and parse warnings.",
            json!({}),
            &[],
        ),
        definition(
            "list_symbols",
            "List contract/library/interface, overloads, modifiers and declarations. Use offset for pagination.",
            json!({"file":{"type":"string"},"offset":{"type":"integer"}}),
            &["file"],
        ),
        definition(
            "read_source",
            "Read exact source with 1-based line numbers; end_line is inclusive. Use smaller ranges if over budget.",
            json!({"file":{"type":"string"},"start_line":{"type":"integer"},"end_line":{"type":"integer"}}),
            &["file", "start_line", "end_line"],
        ),
        definition(
            "read_symbol",
            "Read exact indexed source by unique symbol id, including overloads. Use read_source for large symbols.",
            json!({"file":{"type":"string"},"symbol_id":{"type":"string"}}),
            &["file", "symbol_id"],
        ),
        definition(
            "search_source",
            "Case-insensitive text search across all indexed source; not a semantic call graph. Paginate with offset.",
            json!({"query":{"type":"string"},"offset":{"type":"integer"}}),
            &["query"],
        ),
        definition(
            "knowledge_catalog",
            "List embedded cluster document filenames and checklist categories.",
            json!({}),
            &[],
        ),
        definition(
            "search_knowledge",
            "Search historic vulnerability examples by keywords; results provide offsets for read_knowledge.",
            json!({"query":{"type":"string"}}),
            &["query"],
        ),
        definition(
            "read_knowledge",
            "Read embedded historic examples, never target-project evidence. Offsets and limits count Unicode characters.",
            json!({"name":{"type":"string"},"offset":{"type":"integer"},"limit":{"type":"integer"}}),
            &["name", "offset", "limit"],
        ),
        definition(
            "checklist",
            "Read checklist items for an exact top-level category, 10 per page.",
            json!({"category":{"type":"string"},"offset":{"type":"integer"}}),
            &["category"],
        ),
    ]
}

impl Toolbox {
    pub fn execute(&self, name: &str, args: &Value) -> Result<Value> {
        ensure!(args.is_object(), "tool arguments must be an object");
        let text = |key: &str| {
            args[key]
                .as_str()
                .with_context(|| format!("missing string argument {key}"))
        };
        let number = |key: &str| {
            args[key]
                .as_u64()
                .map(|n| n as usize)
                .with_context(|| format!("missing non-negative integer {key}"))
        };
        let offset = args
            .get("offset")
            .map(|_| number("offset"))
            .transpose()?
            .unwrap_or(0);
        let result = match name {
            "list_files" => self.project.overview(),
            "list_symbols" => {
                let file = self.project.file(text("file")?)?;
                ensure!(offset <= file.symbols.len(), "symbol offset out of range");
                let end = (offset + 20).min(file.symbols.len());
                json!({"symbols":&file.symbols[offset..end],"next_offset":if end<file.symbols.len(){Some(end)}else{None},"total":file.symbols.len()})
            }
            "read_source" => {
                let file = text("file")?;
                let start = number("start_line")?;
                let end = number("end_line")?;
                let source = self.project.lines(file, start, end)?;
                json!({"file":file,"start_line":start,"end_line":end,"source":source,"numbered_source":source.lines().enumerate().map(|(i,l)|format!("{}: {}",start+i,l)).collect::<Vec<_>>().join("\n")})
            }
            "read_symbol" => {
                let file = self.project.file(text("file")?)?;
                let id = text("symbol_id")?;
                let symbol = file
                    .symbols
                    .iter()
                    .find(|s| s.id == id)
                    .context("symbol not found; use list_symbols")?;
                json!({"file":file.path,"symbol":symbol,"source":&file.contents[symbol.start_byte..symbol.end_byte]})
            }
            "search_source" => {
                let query = text("query")?.to_lowercase();
                ensure!(!query.trim().is_empty(), "empty search query");
                let mut hits = vec![];
                for file in self.project.files.values() {
                    for (i, line) in file.contents.lines().enumerate() {
                        if line.to_lowercase().contains(&query) {
                            hits.push(json!({"file":file.path,"line":i+1,"text":line}));
                        }
                    }
                }
                ensure!(offset <= hits.len(), "search offset out of range");
                let end = (offset + 30).min(hits.len());
                json!({"hits":&hits[offset..end],"next_offset":if end<hits.len(){Some(end)}else{None},"total":hits.len()})
            }
            "knowledge_catalog" => self.knowledge.catalog(),
            "search_knowledge" => {
                let query = text("query")?;
                ensure!(!query.trim().is_empty(), "empty query");
                self.knowledge.search(query)
            }
            "read_knowledge" => self
                .knowledge
                .read(text("name")?, offset, number("limit")?)?,
            "checklist" => {
                let category = text("category")?;
                ensure!(
                    self.knowledge.categories().iter().any(|c| c == category),
                    "unknown checklist category"
                );
                let items: Vec<_> = self
                    .knowledge
                    .checklist
                    .iter()
                    .filter(|i| i.category == category)
                    .collect();
                ensure!(offset <= items.len(), "checklist offset out of range");
                let end = (offset + 10).min(items.len());
                json!({"items":&items[offset..end],"next_offset":if end<items.len(){Some(end)}else{None},"total":items.len()})
            }
            _ => bail!("unknown tool: {name}"),
        };
        ensure!(
            serde_json::to_string(&result)?.chars().count() <= self.max_chars,
            "tool result exceeds budget; narrow source range or use a smaller document page"
        );
        Ok(result)
    }
}
