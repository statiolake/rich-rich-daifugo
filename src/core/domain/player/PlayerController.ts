import { Card } from '../card/Card';

/**
 * カード選択のバリデーター
 * 選択されたカードの組み合わせが有効かどうかを判定
 */
export interface Validator {
  validate(cards: Card[]): boolean;
}

/**
 * プレイヤーコントローラーインターフェース
 * 人間・CPUを問わず、プレイヤーの意思決定を抽象化
 */
export interface PlayerController {
  /**
   * 手札からカードを選択（プレイ、パス、特殊ルール用カード選択すべてに対応）
   *
   * validator により、以下のすべてのケースに対応:
   * - 通常プレイ: validator が有効な組み合わせを判定
   * - パス: 空配列を返す（validator は常に true を返す）
   * - 7渡し: validator が1枚のみ許可
   * - 10捨て: validator が10より弱いカードのみ許可
   * - クイーンボンバー: validator が指定ランクのみ許可
   *
   * @param validator カード選択のバリデーター
   * @returns 選択されたカードの配列（パスの場合は空配列）
   */
  chooseCardsInHand(validator: Validator): Promise<Card[]>;

  /**
   * クイーンボンバー用のランクを選択
   * 手札とは別のUIでランクを選択するため、別メソッド
   *
   * @returns 選択されたランク（'3' ~ 'A', '2'）
   */
  chooseRankForQueenBomber(): Promise<string>;
}
