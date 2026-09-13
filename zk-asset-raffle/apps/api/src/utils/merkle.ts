import { keccak256, toUtf8Bytes } from "ethers";

function normalizeHex(input: string): string {
  return input.startsWith("0x") ? input.slice(2) : input;
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(normalizeHex(hex), "hex");
}

function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

export function hashLeaf(sid: string, r_i: string, win_i: number): string {
  const raw = `${sid}${r_i}${win_i}`;
  const hash = keccak256(toUtf8Bytes(raw));
  return normalizeHex(hash);
}

export type MerkleProofNode = {
  position: "left" | "right";
  data: string;
};

export class MerkleTree {
  private layers: Buffer[][] = [];

  constructor(leaves: string[]) {
    const leafBuffers = leaves.map((leaf) => hexToBuffer(leaf));
    this.layers = [leafBuffers];
    this.buildTree();
  }

  private buildTree() {
    let current = this.layers[0];
    while (current.length > 1) {
      const next: Buffer[] = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 === current.length) {
          next.push(current[i]);
          continue;
        }
        const a = current[i];
        const b = current[i + 1];
        const combined = Buffer.compare(a, b) <= 0 ? Buffer.concat([a, b]) : Buffer.concat([b, a]);
        const hashed = keccak256(combined);
        next.push(hexToBuffer(hashed));
      }
      this.layers.push(next);
      current = next;
    }
  }

  root(): string {
    const top = this.layers[this.layers.length - 1][0];
    return bufferToHex(top);
  }

  getProof(index: number): MerkleProofNode[] {
    if (index < 0 || index >= this.layers[0].length) {
      throw new Error("Leaf index out of range");
    }

    const proof: MerkleProofNode[] = [];
    let idx = index;

    for (const layer of this.layers.slice(0, -1)) {
      const isRightNode = idx % 2 === 1;
      const pairIndex = isRightNode ? idx - 1 : idx + 1;

      if (pairIndex < layer.length) {
        proof.push({
          position: isRightNode ? "left" : "right",
          data: bufferToHex(layer[pairIndex])
        });
      }

      idx = Math.floor(idx / 2);
    }

    return proof;
  }
}

export function buildMerkle(leaves: string[]) {
  const tree = new MerkleTree(leaves);
  const root = tree.root();
  const proofs = leaves.map((_, idx) => tree.getProof(idx));
  return { root, proofs };
}
