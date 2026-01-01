import { Card, Rank } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { FieldClass as Field } from '../domain/game/Field';
import { GameState } from '../domain/game/GameState';
import { ValidationResult } from '../rules/base/RuleEngine';

export interface PlayDecision {
  type: 'PLAY' | 'PASS';
  cards?: Card[];
}

/**
 * カード選択のバリデーター
 * 選択されたカードが有効かどうかを判定する
 */
export type CardValidator = (cards: Card[]) => ValidationResult;

/**
 * カード選択時のコンテキスト情報
 */
export interface CardSelectionContext {
  message?: string; // 表示メッセージ
  specifiedRank?: Rank; // Qボンバーで指定されたランク
}

export interface PlayerStrategy {
  /**
   * プレイヤーの行動を決定する
   * @returns PLAY（カードを出す）またはPASS（パス）の決定
   */
  decidePlay(
    player: Player,
    field: Field,
    gameState: GameState
  ): Promise<PlayDecision>;

  /**
   * カード交換時に渡すカードを決定する
   * @param count 渡すカードの枚数
   * @returns 渡すカードの配列
   */
  decideExchangeCards(
    player: Player,
    count: number
  ): Promise<Card[]>;

  /**
   * 手札からカードを選択する（プレイ、10捨て、Qボンバーなど全てに対応）
   * @param player プレイヤー
   * @param validator 選択したカードが有効かどうかを判定する関数
   * @param context 選択時のコンテキスト情報（表示用）
   * @returns 選択したカードの配列（スキップの場合は空配列）
   */
  selectCards(
    player: Player,
    validator: CardValidator,
    context?: CardSelectionContext
  ): Promise<Card[]>;

  /**
   * ランクを選択する（Qボンバーで使用）
   * @param player プレイヤー
   * @returns 選択したランク
   */
  selectRank(
    player: Player
  ): Promise<Rank>;
}

/**
 * CPUStrategy is an alias for PlayerStrategy (for backward compatibility)
 */
export type CPUStrategy = PlayerStrategy;
