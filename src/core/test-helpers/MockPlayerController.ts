import { PlayerController, Validator } from '../domain/player/PlayerController';
import { Card } from '../domain/card/Card';

/**
 * テスト用のモック PlayerController
 * カード選択とランク選択の動作をプログラム可能に制御
 */
export class MockPlayerController implements PlayerController {
  private cardChoices: Card[][] = [];
  private rankChoices: string[] = [];
  private discardChoices: Card[][] = [];
  private cardChoiceIndex = 0;
  private rankChoiceIndex = 0;
  private discardChoiceIndex = 0;

  /**
   * 次のカード選択時に返すカードを設定
   */
  setNextCardChoice(cards: Card[]): void {
    this.cardChoices.push(cards);
  }

  /**
   * 次のランク選択時に返すランクを設定
   */
  setNextRankChoice(rank: string): void {
    this.rankChoices.push(rank);
  }

  /**
   * 次の捨て札選択時に返すカードを設定
   */
  setNextDiscardChoice(cards: Card[]): void {
    this.discardChoices.push(cards);
  }

  async chooseCardsInHand(_validator: Validator, _prompt?: string): Promise<Card[]> {
    if (this.cardChoiceIndex >= this.cardChoices.length) {
      throw new Error('No more card choices available in mock');
    }
    const choice = this.cardChoices[this.cardChoiceIndex];
    this.cardChoiceIndex++;
    return choice;
  }

  async chooseRankForQueenBomber(): Promise<string> {
    if (this.rankChoiceIndex >= this.rankChoices.length) {
      throw new Error('No more rank choices available in mock');
    }
    const choice = this.rankChoices[this.rankChoiceIndex];
    this.rankChoiceIndex++;
    return choice;
  }

  async chooseCardsFromDiscard(_discardPile: Card[], _maxCount: number, _prompt: string): Promise<Card[]> {
    if (this.discardChoiceIndex >= this.discardChoices.length) {
      // デフォルトは空配列を返す（何も選択しない）
      return [];
    }
    const choice = this.discardChoices[this.discardChoiceIndex];
    this.discardChoiceIndex++;
    return choice;
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, _prompt: string): Promise<Card[]> {
    // デフォルト: 手札から先頭 exactCount 枚を選択
    return handCards.slice(0, exactCount);
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.cardChoices = [];
    this.rankChoices = [];
    this.discardChoices = [];
    this.cardChoiceIndex = 0;
    this.rankChoiceIndex = 0;
    this.discardChoiceIndex = 0;
  }
}
