use crate::config::Config;
use anyhow::{Context, Result, bail, ensure};
use serde::Serialize;
use sha2::{Digest, Sha256};
use solang_parser::{
    helpers::CodeLocation,
    pt::{ContractPart, Loc, SourceUnitPart},
};
use std::{
    collections::BTreeMap, fs, path::{Component, Path, PathBuf},
};

pub fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map( |byte| format!("{byte:02x}"))
        .collect()
        
}

#[derive(Clone, Debug, Serialize)]
pub struct Symbol {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub contract: Option<String>,
    pub signature: String,
    pub start_line: usize,
    pub end_line: usize,
    pub start_byte: usize,
    pub end_byte: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct SourceFile {
    pub path: String,
    pub symbols: Vec<Symbol>,
    pub imports: Vec<String>,
    pub line_count: usize,
    #[serde(skip)]
    pub contents: String,
}

#[derive(Clone, Debug)]
pub struct Project {
    pub root: PathBuf,
    pub files: BTreeMap<String, SourceFile>,
    pub warnings: Vec<String>,
    pub failures: Vec<String>,
    pub hash: String,
}

fn line_at(source: &str, offset: usize) -> usize {
    source.as_bytes()[..offset.min(source.len())]
        .iter()
        .filter(|b| **b == b'\n')
        .count()
        + 1
}

fn symbol(
    source: &str,
    path: &str,
    loc: Loc,
    name: String,
    kind: String,
    contract: Option<String>,
    header_end: Option<usize>,
) -> Symbol {
    let start = loc.start();
    let end = loc.end().min(source.len());
    let header_end = header_end.unwrap_or(end).min(end);
    Symbol {
        id: format!("{path}:{start}"),
        name,
        kind,
        contract,
        signature: source[start..header_end].trim().into(),
        start_line: line_at(source, start),
        end_line: line_at(source, end.saturating_sub(1)),
        start_byte: start,
        end_byte: end,
    }
}

pub fn parse_file(path: &str, contents: String) -> Result<SourceFile> {
    let (tree, _) = solang_parser::parse(&contents, 0)
        .map_err(|errors| anyhow::anyhow!("Solidity parse failed: {errors:?}"))?;
    let mut symbols = Vec::new();
    let mut imports = Vec::new();
    for part in tree.0 {
        match part {
            SourceUnitPart::ContractDefinition(def) => {
                let name = def
                    .name
                    .as_ref()
                    .map(|n| n.name.clone())
                    .unwrap_or_default();
                let first_part = def
                    .parts
                    .first()
                    .map(|p| p.loc().start())
                    .unwrap_or(def.loc.end());
                symbols.push(symbol(
                    &contents,
                    path,
                    def.loc,
                    name.clone(),
                    format!("{:?}", def.ty),
                    None,
                    Some(first_part),
                ));
                for part in def.parts {
                    match part {
                        ContractPart::FunctionDefinition(f) => {
                            symbols.push(symbol(
                                &contents,
                                path,
                                f.loc,
                                f.name
                                    .as_ref()
                                    .map(|n| n.name.clone())
                                    .unwrap_or(format!("{:?}", f.ty)),
                                format!("{:?}", f.ty),
                                Some(name.clone()),
                                f.body.as_ref().map(|b| b.loc().start()),
                            ));
                        }
                        other => {
                            let kind = match &other {
                                ContractPart::VariableDefinition(_) => "state_variable",
                                ContractPart::StructDefinition(_) => "struct",
                                ContractPart::EnumDefinition(_) => "enum",
                                ContractPart::EventDefinition(_) => "event",
                                ContractPart::ErrorDefinition(_) => "error",
                                ContractPart::Using(_) => "using",
                                _ => "declaration",
                            };
                            let loc = other.loc();
                            symbols.push(symbol(
                                &contents,
                                path,
                                loc,
                                kind.into(),
                                kind.into(),
                                Some(name.clone()),
                                None,
                            ));
                        }
                    }
                }
            }
            SourceUnitPart::FunctionDefinition(f) => symbols.push(symbol(
                &contents,
                path,
                f.loc,
                f.name.as_ref().map(|n| n.name.clone()).unwrap_or_default(),
                "free_function".into(),
                None,
                f.body.as_ref().map(|b| b.loc().start()),
            )),
            SourceUnitPart::ImportDirective(import) => {
                let loc = import.loc();
                imports.push(contents[loc.start()..loc.end()].into());
            }
            other => {
                let loc = other.loc();
                symbols.push(symbol(
                    &contents,
                    path,
                    loc,
                    "file_declaration".into(),
                    "file_declaration".into(),
                    None,
                    None,
                ));
            }
        }
    }
    Ok(SourceFile {
        path: path.into(),
        symbols,
        imports,
        line_count: contents.lines().count(),
        contents,
    })
}

impl Project {
    pub fn load(root: &Path, config: &Config) -> Result<Self> {
        let root = root.canonicalize().context("project path does not exist")?;
        ensure!(root.is_dir(), "project must be a directory");
        let mut project = Self {
            root: root.clone(),
            files: BTreeMap::new(),
            warnings: vec![],
            failures: vec![],
            hash: String::new(),
        };
        let mut pending = vec![root.clone()];
        let mut paths = vec![];
        while let Some(dir) = pending.pop() {
            for entry in
                fs::read_dir(&dir).with_context(|| format!("cannot enumerate {}", dir.display()))?
            {
                let entry = entry?;
                let path = entry.path();
                let kind = entry.file_type()?;
                let relative = path
                    .strip_prefix(&root)?
                    .to_string_lossy()
                    .replace('\\', "/");
                if kind.is_symlink() {
                    project
                        .warnings
                        .push(format!("Skipped symlink: {relative}"));
                    continue;
                }
                if kind.is_dir() {
                    if config
                        .exclude_dirs
                        .iter()
                        .any(|d| entry.file_name() == d.as_str())
                    {
                        project
                            .warnings
                            .push(format!("Excluded directory: {relative}"));
                    } else {
                        pending.push(path);
                    }
                } else if path.extension().is_some_and(|e| e == "sol") {
                    if relative.ends_with(".t.sol") {
                        project.warnings.push(format!("Excluded test: {relative}"));
                    } else {
                        paths.push(path);
                    }
                }
            }
        }
        paths.sort();
        let mut bytes = 0;
        for path in paths {
            let relative = path
                .strip_prefix(&root)?
                .to_str()
                .context("source path must be UTF-8")?
                .replace('\\', "/");
            let length = fs::metadata(&path)?.len() as usize;
            ensure!(
                length <= config.max_file_bytes,
                "source exceeds max_file_bytes: {relative}"
            );
            bytes += length;
            ensure!(
                bytes <= config.max_project_bytes,
                "project exceeds max_project_bytes"
            );
            let contents =
                fs::read_to_string(&path).with_context(|| format!("cannot read {relative}"))?;
            match parse_file(&relative, contents.clone()) {
                Ok(file) => {
                    project.files.insert(relative, file);
                }
                Err(error) => {
                    project.failures.push(format!("{relative}: {error}"));
                    project.files.insert(
                        relative.clone(),
                        SourceFile {
                            path: relative,
                            symbols: vec![],
                            imports: vec![],
                            line_count: contents.lines().count(),
                            contents,
                        },
                    );
                }
            }
        }
        ensure!(!project.files.is_empty(), "no Solidity files in scan scope");
        let manifest: Vec<_> = project
            .files
            .iter()
            .map(|(path, file)| (path, &file.contents))
            .collect();
        project.hash = hash(&serde_json::to_vec(&manifest)?);
        Ok(project)
    }

    pub fn file(&self, path: &str) -> Result<&SourceFile> {
        ensure!(
            !Path::new(path).is_absolute(),
            "absolute source paths are not allowed"
        );
        let mut components = Vec::new();
        for component in Path::new(path).components() {
            match component {
                Component::Normal(s) => components.push(s.to_str().context("invalid path")?),
                Component::CurDir => {}
                _ => bail!("parent traversal is not allowed"),
            }
        }
        self.files
            .get(&components.join("/"))
            .context("file is not in the indexed scan scope")
    }

    pub fn lines(&self, path: &str, start: usize, end: usize) -> Result<String> {
        let file = self.file(path)?;
        ensure!(
            start > 0 && end >= start && end <= file.line_count,
            "invalid source line range for {path}"
        );
        Ok(file
            .contents
            .lines()
            .skip(start - 1)
            .take(end - start + 1)
            .collect::<Vec<_>>()
            .join("\n"))
    }

    pub fn overview(&self) -> serde_json::Value {
        serde_json::json!({"files":self.files.values().map(|f|serde_json::json!({"path":f.path,"lines":f.line_count,"symbols":f.symbols.len(),"imports":f.imports})).collect::<Vec<_>>(),"warnings":self.warnings,"parse_failures":self.failures})
    }
}
