import { PlayerController, Validator } from '../domain/player/PlayerController';
import { Card } from '../domain/card/Card';
import { Player } from '../domain/player/Player';

/**
 * テスト用のモック PlayerController
 * カード選択とランク選択の動作をプログラム可能に制御
 */
export class MockPlayerController implements PlayerController {
  private cardChoices: Card[][] = [];
  private rankChoices: string[] = [];
  private discardChoices: Card[][] = [];
  private playerChoices: string[] = [];
  private opponentCardChoices: Card[][] = [];
  private choosePlayerChoices: Player[] = [];
  private cardChoiceIndex = 0;
  private rankChoiceIndex = 0;
  private discardChoiceIndex = 0;
  private playerChoiceIndex = 0;
  private opponentCardChoiceIndex = 0;
  private choosePlayerChoiceIndex = 0;

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

  /**
   * 次のプレイヤー選択時に返すプレイヤーIDを設定
   */
  setNextPlayerChoice(playerId: string): void {
    this.playerChoices.push(playerId);
  }

  /**
   * 次の対戦相手手札選択時に返すカードを設定（産業革命用）
   */
  setNextOpponentCardChoice(cards: Card[]): void {
    this.opponentCardChoices.push(cards);
  }

  /**
   * 次のプレイヤー選択時に返すプレイヤーを設定（choosePlayer用）
   */
  setNextChoosePlayerChoice(player: Player): void {
    this.choosePlayerChoices.push(player);
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

  async choosePlayerForBlackMarket(
    playerIds: string[],
    _playerNames: Map<string, string>,
    _prompt: string
  ): Promise<string> {
    if (this.playerChoiceIndex >= this.playerChoices.length) {
      // デフォルト: 最初のプレイヤーを選択
      return playerIds[0];
    }
    const choice = this.playerChoices[this.playerChoiceIndex];
    this.playerChoiceIndex++;
    return choice;
  }

  async chooseCardsFromOpponentHand(cards: Card[], _maxCount: number, _prompt: string): Promise<Card[]> {
    if (this.opponentCardChoiceIndex >= this.opponentCardChoices.length) {
      // デフォルト: 最初のカードを選択
      return cards.length > 0 ? [cards[0]] : [];
    }
    const choice = this.opponentCardChoices[this.opponentCardChoiceIndex];
    this.opponentCardChoiceIndex++;
    return choice;
  }

  async choosePlayer(players: Player[], _prompt: string): Promise<Player | null> {
    if (this.choosePlayerChoiceIndex >= this.choosePlayerChoices.length) {
      // デフォルト: 最初のプレイヤーを選択
      return players.length > 0 ? players[0] : null;
    }
    const choice = this.choosePlayerChoices[this.choosePlayerChoiceIndex];
    this.choosePlayerChoiceIndex++;
    return choice;
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.cardChoices = [];
    this.rankChoices = [];
    this.discardChoices = [];
    this.playerChoices = [];
    this.opponentCardChoices = [];
    this.choosePlayerChoices = [];
    this.cardChoiceIndex = 0;
    this.rankChoiceIndex = 0;
    this.discardChoiceIndex = 0;
    this.playerChoiceIndex = 0;
    this.opponentCardChoiceIndex = 0;
    this.choosePlayerChoiceIndex = 0;
  }
}
