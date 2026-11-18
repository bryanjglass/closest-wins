/** Player look-and-feel palette. Colors are assigned by the server; avatars are picked by players. */
export const PLAYER_COLORS = [
  '#ff5d8f', '#ffc53d', '#3ee0a1', '#4cc9f0', '#b78cff', '#ff8a3d',
  '#e9f05a', '#21d4c4', '#ff6b6b', '#9be15d', '#ff9de2', '#7aa7ff',
  '#ffd6a5', '#c0f2ff', '#e0b0ff', '#b9fbc0',
] as const;

export const PLAYER_AVATARS = [
  '🦊', '🐙', '🦄', '🐸', '🐧', '🦖', '🐝', '🐼',
  '🦉', '🐢', '🦀', '🐳', '🦔', '🐨', '🦜', '🐌',
  '🐯', '🦁', '🐮', '🐷', '🐵', '🦒', '🦩', '🐬',
] as const;

export function isAvatar(value: unknown): value is (typeof PLAYER_AVATARS)[number] {
  return typeof value === 'string' && (PLAYER_AVATARS as readonly string[]).includes(value);
}
