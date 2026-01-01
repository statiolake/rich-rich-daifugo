/**
 * プレイヤーID（branded type）
 *
 * 文字列に型安全性を付与するための branded type パターン。
 * 実行時は単なる string だが、コンパイル時に型チェックが効く。
 */
export type PlayerId = string & { readonly __brand: 'PlayerId' };

/**
 * 文字列から PlayerId を作成
 */
export function createPlayerId(value: string): PlayerId {
  return value as PlayerId;
}

/**
 * PlayerId が等しいかどうかを比較
 */
export function playerIdEquals(a: PlayerId, b: PlayerId): boolean {
  return a === b;
}
