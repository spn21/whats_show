use anyhow::{Context, Result, ensure};
use serde::Serialize;
use serde_json::Value;

include!(concat!(env!("OUT_DIR"), "/knowledge.rs"));

#[derive(Clone, Debug, Serialize)]
pub struct ChecklistItem {
    pub id: String,
    pub category: String,
    pub category_chain: Vec<String>,
    pub question: String,
    pub description: String,
    pub remediation: String,
}

#[derive(Clone)]
pub struct Knowledge {
    pub checklist: Vec<ChecklistItem>,
}

impl Knowledge {
    pub fn embedded() -> Result<Self> {
        let data: Value = serde_json::from_str(include_str!("../agents/checklist.json"))?;
        let mut checklist = vec![];
        fn visit(value: &Value, chain: &[String], out: &mut Vec<ChecklistItem>) {
            if let Some(array) = value.as_array() {
                for v in array {
                    visit(v, chain, out);
                }
            } else if let Some(category) = value["category"].as_str() {
                let mut chain = chain.to_vec();
                chain.push(category.into());
                visit(&value["data"], &chain, out);
            } else if let Some(id) = value["id"].as_str() {
                let get = |key: &str| value[key].as_str().unwrap_or_default().to_owned();
                out.push(ChecklistItem {
                    id: id.into(),
                    category: chain.first().cloned().unwrap_or_default(),
                    category_chain: chain.to_vec(),
                    question: get("question"),
                    description: get("description"),
                    remediation: get("remediation"),
                });
            }
        }
        visit(&data, &[], &mut checklist);
        ensure!(!checklist.is_empty(), "embedded checklist is empty");
        Ok(Self { checklist })
    }
    pub fn categories(&self) -> Vec<String> {
        self.checklist
            .iter()
            .map(|i| i.category.clone())
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect()
    }
    pub fn catalog(&self) -> Value {
        serde_json::json!({"categories":self.categories(),"documents":DOCUMENTS.iter().map(|(name,text)|serde_json::json!({"name":name,"chars":text.chars().count(),"first_heading":text.lines().find(|l|l.starts_with('#')).unwrap_or("")})).collect::<Vec<_>>()})
    }
    pub fn read(&self, name: &str, offset: usize, limit: usize) -> Result<Value> {
        let (_, text) = DOCUMENTS
            .iter()
            .find(|(n, _)| *n == name)
            .context("unknown embedded knowledge filename")?;
        ensure!(
            limit > 0 && limit <= 12_000,
            "knowledge limit must be 1..12000 characters"
        );
        let total = text.chars().count();
        ensure!(offset <= total, "knowledge offset exceeds document");
        let content: String = text.chars().skip(offset).take(limit).collect();
        let next = offset + content.chars().count();
        Ok(
            serde_json::json!({"name":name,"offset":offset,"content":content,"next_offset":if next<total {Some(next)} else {None},"total_chars":total}),
        )
    }
    pub fn search(&self, query: &str) -> Value {
        let terms: Vec<_> = query.split_whitespace().map(str::to_lowercase).collect();
        let mut hits = vec![];
        for (name, text) in DOCUMENTS {
            let mut offset = 0;
            for chunk in text.chars().collect::<Vec<_>>().chunks(3000) {
                let chunk: String = chunk.iter().collect();
                let lower = chunk.to_lowercase();
                let score = terms.iter().filter(|t| lower.contains(t.as_str())).count();
                if score > 0 {
                    hits.push((
                        score,
                        *name,
                        offset,
                        chunk.chars().take(900).collect::<String>(),
                    ));
                }
                offset += chunk.chars().count();
            }
        }
        hits.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(b.1)).then(a.2.cmp(&b.2)));
        serde_json::json!(hits.into_iter().take(8).map(|(score,name,offset,excerpt)|serde_json::json!({"name":name,"offset":offset,"score":score,"excerpt":excerpt})).collect::<Vec<_>>())
    }
}
