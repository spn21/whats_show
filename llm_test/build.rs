use sha2::{Digest, Sha256};
use std::{env, fs, path::PathBuf};

fn main() {
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let dataset = root.join("agents/cluster_knowledge");
    println!("cargo:rerun-if-changed ={}", dataset.display());
    let mut paths: Vec<_> = fs::read_dir(&dataset)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "md"))
        .collect();
    paths.sort();
    assert!(!paths.is_empty(), "embedded knowledge not be empty");

    //
    let mut generated = String::from("pub const DOCUMENTS: &[(&str, &str)] = &[\n");
    let mut digest = Sha256::new();
    for path in paths {
        let name = path.file_name().unwrap().to_str().unwrap();
        let contents = fs::read_to_string(&path).unwrap();
        digest.update(name.as_bytes());
        digest.update(contents.as_bytes());
        generated.push_str(&format!("({name:?}, {contents:?}), \n"));
    }

    generated.push_str("];\n");

    let mut implementation_paths: Vec<_> = [
        "Cargo.toml",
        "Cargo.lock",
        "build.rs",
        "agents/checklist.json",
    ]
    .into_iter()
    .map(|p| root.join(p))
    .chain(
        fs::read_dir(root.join("src"))
            .unwrap()
            .map(|p| p.unwrap().path()),
    )
    .collect();

    implementation_paths.sort();
    for path in implementation_paths {
        if path.is_file() {
            println!("cargo:rerun-if-changed ={}", path.display());
            digest.update(fs::read(path).unwrap());
        }
    }

    //in sha2 0.11.0, byte transfer to hex string, should be noticed
    //  the trait bound `Array<u8, UInt<UInt<UInt<UInt<..., ...>, ...>, ...>, ...>>: LowerHex` is not satisfied
    //  the following other types implement trait `LowerHex`:
    //   &T
    //   &mut T
    //   Saturating<T>
    //   Wrapping<T>
    //   bytes::bytes::Bytes
    //   bytes::bytes_mut::BytesMut
    //   either::Either<L, R>
    //   i128
    let digest_bytes = digest.finalize();

    let digest_hex: String = digest_bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();

    generated.push_str(&format!(
        "pub const BUILD_FINGERPRINT: &str = {:?};\n",
        digest_hex
    ));

    fs::write(
        PathBuf::from(env::var("OUT_DIR").unwrap()).join("knowledge.rs"),
        generated,
    )
    .unwrap()
}
