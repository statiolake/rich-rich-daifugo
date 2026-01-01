/**
 * Core層のアクション型定義
 *
 * PlayerControllerの結果をイベントとして発行する際に使用する型。
 * ネットワーク層のPlayerAction型とは別に定義し、
 * ActionAdapterで変換することでレイヤー境界を維持する。
 */

/**
 * カード選択アクション
 * 通常のカードプレイ、捨て札からの選択、相手の手札からの選択など
 */
export interface CardSelectionAction {
  type: 'CARD_SELECTION';
  cardIds: string[];
  isPass: boolean;
}

/**
 * ランク選択アクション
 * クイーンボンバーでのランク指定など
 */
export interface RankSelectionAction {
  type: 'RANK_SELECTION';
  rank: string;
}

/**
 * スート選択アクション
 * 将来の拡張用（現在は未使用）
 */
export interface SuitSelectionAction {
  type: 'SUIT_SELECTION';
  suit: string;
}

/**
 * カード交換アクション
 * 大富豪⇔大貧民間の交換
 */
export interface CardExchangeAction {
  type: 'CARD_EXCHANGE';
  cardIds: string[];
}

/**
 * プレイヤー選択アクション
 * ブラックマーケットなどでのターゲット選択
 */
export interface PlayerSelectionAction {
  type: 'PLAYER_SELECTION';
  targetPlayerId: string;
}

/**
 * プレイヤー順序選択アクション
 * ソートキングなどでの順番指定
 */
export interface PlayerOrderAction {
  type: 'PLAYER_ORDER';
  playerIds: string[];
}

/**
 * カウントダウン値選択アクション
 * カウントダウンルールでの数値選択
 */
export interface CountdownValueAction {
  type: 'COUNTDOWN_VALUE';
  value: number;
}

/**
 * Core層のアクション型（Union型）
 */
export type CoreAction =
  | CardSelectionAction
  | RankSelectionAction
  | SuitSelectionAction
  | CardExchangeAction
  | PlayerSelectionAction
  | PlayerOrderAction
  | CountdownValueAction;

/**
 * プレイヤーアクションイベントのペイロード
 */
export interface PlayerActionEvent {
  playerId: string;
  action: CoreAction;
}
