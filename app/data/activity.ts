import type { GameAccent } from './games';

export interface RecentScore {
  player: string;
  game: string;
  score: number;
  ago: string;
  color: GameAccent;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export const RECENT_SCORES: readonly RecentScore[] = [
  { player: 'NEONFOX', game: 'Caída', score: 184220, ago: 'hace 2 min', color: 'magenta' },
  { player: 'PX_KAI', game: 'Glotón', score: 96400, ago: 'hace 5 min', color: 'yellow' },
  { player: 'Z3R0COOL', game: 'Invasores', score: 54190, ago: 'hace 8 min', color: 'green' },
  { player: 'VAULT_07', game: 'Rocas', score: 41200, ago: 'hace 12 min', color: 'cyan' },
  { player: 'GLITCHA', game: 'Bloque Buster', score: 28450, ago: 'hace 18 min', color: 'cyan' },
  { player: 'ARKADYA', game: 'Serpentina', score: 7820, ago: 'hace 24 min', color: 'green' },
  { player: 'CYBER_LU', game: 'Ranaria', score: 18900, ago: 'hace 31 min', color: 'yellow' },
];

export const TOP_PLAYERS: readonly TopPlayer[] = [
  { rank: 1, player: 'NEONFOX', score: 312840 },
  { rank: 2, player: 'PX_KAI', score: 248110 },
  { rank: 3, player: 'M00NRYU', score: 196720 },
  { rank: 4, player: 'VAULT_07', score: 154300 },
  { rank: 5, player: 'GLITCHA', score: 138900 },
];
