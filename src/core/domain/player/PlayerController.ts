import { Card } from '../card/Card';
import { ValidationResult } from '../../rules/validators/PlayValidator';

/**
 * カード選択のバリデーター
 * 選択されたカードの組み合わせが有効かどうかを判定
 */
export interface Validator {
  validate(cards: Card[]): ValidationResult;
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
   * @param prompt UIに表示するリード文（通常プレイ時はundefined）
   * @returns 選択されたカードの配列（パスの場合は空配列）
   */
  chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]>;

  /**
   * クイーンボンバー用のランクを選択
   * 手札とは別のUIでランクを選択するため、別メソッド
   *
   * @returns 選択されたランク（'3' ~ 'A', '2'）
   */
  chooseRankForQueenBomber(): Promise<string>;

  /**
   * 捨て札からカードを選択（サルベージ、キングの行進用）
   *
   * @param discardPile 捨て札の配列
   * @param maxCount 選択可能な最大枚数
   * @param prompt UIに表示するリード文
   * @returns 選択されたカードの配列（0枚以上maxCount枚以下）
   */
  chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]>;

  /**
   * 交換フェーズ用のカード選択
   *
   * @param handCards 手札の配列
   * @param exactCount 選択する枚数（必ずこの枚数を選択）
   * @param prompt UIに表示するリード文
   * @returns 選択されたカードの配列（exactCount枚）
   */
  chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]>;

  /**
   * 闇市用のプレイヤー選択
   * 自分以外のプレイヤーから1人を選択
   *
   * @param playerIds 選択可能なプレイヤーIDの配列
   * @param playerNames プレイヤー名のマップ（ID -> 名前）
   * @param prompt UIに表示するリード文
   * @returns 選択されたプレイヤーのID
   */
  choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string>;

  /**
   * 対戦相手の手札からカードを選択（産業革命用）
   *
   * @param cards 対戦相手の手札の配列
   * @param maxCount 選択可能な最大枚数
   * @param prompt UIに表示するリード文
   * @returns 選択されたカードの配列
   */
  chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]>;

  /**
   * プレイヤーを選択（死の宣告、赤い5など）
   *
   * @param players 選択可能なプレイヤーの配列
   * @param prompt UIに表示するリード文
   * @returns 選択されたプレイヤー（nullの場合は選択キャンセル）
   */
  choosePlayer(players: import('./Player').Player[], prompt: string): Promise<import('./Player').Player | null>;

  /**
   * カードのランクを選択（6もらい、9もらい用）
   * 欲しいカードのランクを選択する
   *
   * @param prompt UIに表示するリード文
   * @returns 選択されたランク（'3' ~ 'A', '2', 'JOKER'）
   */
  chooseCardRank(prompt: string): Promise<string>;

  /**
   * プレイヤーの順序を選択（9シャッフル用）
   * 対戦相手の新しい席順を選択する
   *
   * @param players 順序を決めるプレイヤーの配列
   * @param prompt UIに表示するリード文
   * @returns 新しい順序で並べられたプレイヤーの配列（nullの場合はキャンセル）
   */
  choosePlayerOrder(players: import('./Player').Player[], prompt: string): Promise<import('./Player').Player[] | null>;

  /**
   * カウントダウン値を選択（終焉のカウントダウン用）
   * 指定された範囲内から値を選択する
   *
   * @param min 最小値
   * @param max 最大値
   * @returns 選択されたカウントダウン値
   */
  chooseCountdownValue(min: number, max: number): Promise<number>;
}
