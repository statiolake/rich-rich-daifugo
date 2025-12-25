import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { GameState, CardSelectionRequest } from '../domain/game/GameState';

export interface PlayDecision {
  type: 'PLAY' | 'PASS';
  cards?: Card[];
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
   * カード選択リクエストに応じてカードを選択する
   * @param player プレイヤー
   * @param request カード選択リクエスト
   * @param gameState ゲーム状態
   * @returns 選択したカードの配列（スキップの場合は空配列）
   */
  decideCardSelection(
    player: Player,
    request: CardSelectionRequest,
    gameState: GameState
  ): Promise<Card[]>;
}
