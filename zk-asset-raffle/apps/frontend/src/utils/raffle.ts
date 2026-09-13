// Shared helpers for raffle front-end logic

export function sidToBytes32(sid: string): string {
  if (sid.startsWith('0x')) return sid.padEnd(66, '0');
  const hex = Buffer.from(sid, 'utf8').toString('hex');
  return '0x' + hex.padEnd(64, '0');
}

export function base64ToHex0x(b64: string): string {
  return `0x${Buffer.from(b64, 'base64').toString('hex')}`;
}

export function shortHash(hash?: string | null, length = 10): string {
  if (!hash) return '';
  return `${hash.slice(0, length)}...`;
}

export function getRaffleStateText(state: number | null): string {
  if (state === null) return 'Loading...';
  switch (state) {
    case 0: return 'Created';
    case 1: return 'Committed';
    case 2: return 'Revealed';
    case 3: return 'Closed';
    default: return 'Unknown';
  }
}
