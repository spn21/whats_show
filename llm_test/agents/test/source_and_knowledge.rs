use llm_test::{
    config::Config,
    knowledge::{DOCUMENTS, Knowledge},
    model::{Finding, Findings, Severity},
    source::{Project, parse_file},
    tools::Toolbox,
};
use serde_json::json;
use std::{fs, sync::Arc};

#[test]
fn ast_preserves_modifiers_overloads_libraries_and_exact_source() {
    let source = r#"pragma solidity ^0.8.20;
library Math { function add(uint a, uint b) internal pure returns(uint) { return a+b; } }
interface I { function f(uint n) external; }
function twice(uint n) pure returns(uint) { return n*2; }
contract C {
    string public url = "https://example.com/a  b";
    modifier onlyOwner() { require(msg.sender == address(1)); _; }
    function f(uint n) external onlyOwner returns(uint) { return n; }
    function f(address a) external pure returns(address) { return a; }
    receive() external payable {}
}
"#;
    let file = parse_file("C.sol", source.into()).unwrap();
    let overloads: Vec<_> = file
        .symbols
        .iter()
        .filter(|s| s.contract.as_deref() == Some("C") && s.name == "f")
        .collect();
    assert_eq!(overloads.len(), 2);
    assert_ne!(overloads[0].id, overloads[1].id);
    assert!(overloads[0].signature.contains("external onlyOwner"));
    assert_eq!(
        &source[overloads[0].start_byte..overloads[0].end_byte],
        "function f(uint n) external onlyOwner returns(uint) { return n; }"
    );
    assert!(
        file.symbols
            .iter()
            .any(|s| s.name == "onlyOwner" && s.kind == "Modifier")
    );
    assert!(file.symbols.iter().any(|s| s.name == "Math"));
    assert!(file.symbols.iter().any(|s| s.name == "I"));
    assert!(
        file.symbols
            .iter()
            .any(|s| s.name == "twice" && s.kind == "free_function")
    );
    assert!(
        file.symbols
            .iter()
            .any(|s| s.signature.contains("https://example.com/a  b"))
    );
}

#[test]
fn unicode_and_line_ranges_match_original() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("C.sol"),
        "// 中文🙂\ncontract C {\n    string public name = unicode\"测试\";\n}\n",
    )
    .unwrap();
    let p = Project::load(dir.path(), &Config::default()).unwrap();
    assert_eq!(
        p.lines("./C.sol", 3, 3).unwrap(),
        "    string public name = unicode\"测试\";"
    );
    let s = p.files["C.sol"]
        .symbols
        .iter()
        .find(|s| s.name == "C")
        .unwrap();
    assert_eq!((s.start_line, s.end_line), (2, 4));
    assert!(p.file("../C.sol").is_err());
    assert!(p.file("/etc/passwd").is_err());
    assert!(p.lines("C.sol", 0, 1).is_err());
    assert!(p.lines("C.sol", 1, 99).is_err());
}

#[test]
fn exact_directory_exclusions_and_parse_failures_are_visible() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("test")).unwrap();
    fs::create_dir(dir.path().join("contest")).unwrap();
    fs::write(dir.path().join("test/Ignore.sol"), "not solidity").unwrap();
    fs::write(dir.path().join("contest/Keep.sol"), "contract Keep {}").unwrap();
    fs::write(dir.path().join("Bad.sol"), "contract {").unwrap();
    let p = Project::load(dir.path(), &Config::default()).unwrap();
    assert_eq!(p.files.len(), 2);
    assert_eq!(p.failures.len(), 1);
    assert!(p.warnings.iter().any(|w| w.contains("test")));
}

#[cfg(unix)]
#[test]
fn external_symlinks_are_not_indexed() {
    let dir = tempfile::tempdir().unwrap();
    let external = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("C.sol"), "contract C {}").unwrap();
    fs::write(external.path().join("Secret.sol"), "contract Secret {}").unwrap();
    std::os::unix::fs::symlink(
        external.path().join("Secret.sol"),
        dir.path().join("Link.sol"),
    )
    .unwrap();
    let p = Project::load(dir.path(), &Config::default()).unwrap();
    assert!(p.file("Link.sol").is_err());
    assert_eq!(p.files.len(), 1);
}

#[test]
fn migrated_knowledge_is_embedded_and_paginates_without_loss() {
    assert_eq!(DOCUMENTS.len(), 40);
    let k = Knowledge::embedded().unwrap();
    assert!(k.categories().contains(&"Token".into()));
    for (name, text) in DOCUMENTS {
        let migrated = fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("agents/cluster_knowledge")
                .join(name),
        )
        .unwrap();
        assert_eq!(*text, migrated);
    }
    let (name, text) = DOCUMENTS[0];
    let mut offset = 0;
    let mut reconstructed = String::new();
    loop {
        let page = k.read(name, offset, 1000).unwrap();
        reconstructed.push_str(page["content"].as_str().unwrap());
        match page["next_offset"].as_u64() {
            Some(n) => offset = n as usize,
            None => break,
        }
    }
    assert_eq!(reconstructed, text);
    assert!(k.read("../config.toml", 0, 10).is_err());
    assert!(!k.search("reentrancy").as_array().unwrap().is_empty());
}

#[test]
fn findings_require_schema_and_real_source_evidence() {
    assert!(serde_json::from_value::<Findings>(json!({"findings":[{}]})).is_err());
    assert!(serde_json::from_value::<Findings>(json!({"findings":[1]})).is_err());
    assert!(
        serde_json::from_value::<Findings>(json!({"findings":[]}))
            .unwrap()
            .findings
            .is_empty()
    );
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("C.sol"), "contract C {}").unwrap();
    let p = Project::load(dir.path(), &Config::default()).unwrap();
    let mut finding = Finding {
        title: "x".into(),
        category: "x".into(),
        severity: Severity::High,
        description: "x".into(),
        attack_scenario: "x".into(),
        preconditions: vec![],
        remediation: "x".into(),
        evidence: vec![llm_test::model::Evidence {
            file: "C.sol".into(),
            start_line: 1,
            end_line: 1,
            snippet: "invented()".into(),
        }],
    };
    assert!(finding.validate(&p).is_err());
    finding.evidence[0].snippet = "contract C {}".into();
    assert!(finding.validate(&p).is_ok());
    let tools = Toolbox {
        project: Arc::new(p),
        knowledge: Arc::new(Knowledge::embedded().unwrap()),
        max_chars: 24000,
    };
    assert!(
        tools
            .execute(
                "read_source",
                &json!({"file":"../C.sol","start_line":1,"end_line":1})
            )
            .is_err()
    );
    assert!(tools.execute("shell", &json!({"command":"id"})).is_err());
    assert!(
        tools
            .execute("checklist", &json!({"category":"missing"}))
            .is_err()
    );
}
