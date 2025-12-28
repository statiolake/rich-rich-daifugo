import { PlayerController, Validator } from '../domain/player/PlayerController';
import { Card } from '../domain/card/Card';

/**
 * テスト用のモック PlayerController
 * カード選択とランク選択の動作をプログラム可能に制御
 */
export class MockPlayerController implements PlayerController {
  private cardChoices: Card[][] = [];
  private rankChoices: string[] = [];
  private cardChoiceIndex = 0;
  private rankChoiceIndex = 0;

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

  async chooseCardsInHand(validator: Validator): Promise<Card[]> {
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

  /**
   * モックをリセット
   */
  reset(): void {
    this.cardChoices = [];
    this.rankChoices = [];
    this.cardChoiceIndex = 0;
    this.rankChoiceIndex = 0;
  }
}
