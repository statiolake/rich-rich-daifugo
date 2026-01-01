import { Play } from '../card/Play';
import { PlayerId } from '../player/PlayerId';

export interface PlayHistory {
  play: Play;
  playerId: PlayerId;
  timestamp: number;
}

/**
 * 場の状態（プレーンオブジェクト）
 * JSON.stringify で直接シリアライズ可能
 */
export interface Field {
  currentPlay: Play | null;
  currentPlayerId: PlayerId | null;
  history: PlayHistory[];
}

/**
 * 空の Field を作成
 */
export function createField(): Field {
  return {
    currentPlay: null,
    currentPlayerId: null,
    history: [],
  };
}

/**
 * 場にプレイを追加
 */
export function fieldAddPlay(field: Field, play: Play, playerId: PlayerId): void {
  field.currentPlay = play;
  field.currentPlayerId = playerId;
  field.history.push({
    play,
    playerId,
    timestamp: Date.now(),
  });
}

/**
 * 場をクリア
 */
export function fieldClear(field: Field): void {
  field.currentPlay = null;
  field.currentPlayerId = null;
  field.history = [];
}

/**
 * 場が空かどうか
 */
export function fieldIsEmpty(field: Field): boolean {
  return field.currentPlay === null;
}

/**
 * 最後のプレイを取得
 */
export function fieldGetLastPlay(field: Field): PlayHistory | null {
  return field.history.length > 0 ? field.history[field.history.length - 1] : null;
}

/**
 * 直前のプレイを履歴から削除
 * 拾い食いルールなどで使用
 */
export function fieldRemoveLastPlay(field: Field): void {
  if (field.history.length > 0) {
    field.history.pop();
    // 履歴が残っている場合、直前のプレイを現在のプレイに設定
    if (field.history.length > 0) {
      const lastPlay = field.history[field.history.length - 1];
      field.currentPlay = lastPlay.play;
      field.currentPlayerId = lastPlay.playerId;
    } else {
      field.currentPlay = null;
      field.currentPlayerId = null;
    }
  }
}

// 後方互換性のためのクラスラッパー（移行期間用）
// 新規コードでは使用しないこと
export class FieldClass implements Field {
  currentPlay: Play | null = null;
  currentPlayerId: PlayerId | null = null;
  history: PlayHistory[] = [];

  getCurrentPlay(): Play | null {
    return this.currentPlay;
  }

  getCurrentPlayerId(): PlayerId | null {
    return this.currentPlayerId;
  }

  addPlay(play: Play, playerId: PlayerId): void {
    fieldAddPlay(this, play, playerId);
  }

  clear(): void {
    fieldClear(this);
  }

  isEmpty(): boolean {
    return fieldIsEmpty(this);
  }

  getHistory(): readonly PlayHistory[] {
    return this.history;
  }

  getLastPlay(): PlayHistory | null {
    return fieldGetLastPlay(this);
  }

  removeLastPlay(): void {
    fieldRemoveLastPlay(this);
  }
}
