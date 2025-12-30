import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { useGameStore } from '../store/gameStore';

type GameStore = ReturnType<typeof useGameStore.getState>;

/**
 * 人間プレイヤー用のコントローラー
 * UI経由でカード選択とランク選択を行う
 */
export class HumanPlayerController implements PlayerController {
  constructor(
    private gameStore: GameStore,
    private playerId: string
  ) {}

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      this.gameStore.setCardSelectionCallback(resolve);
    });

    // 2. UI を表示（validator を渡して、有効なカードのみハイライト）
    this.gameStore.enableCardSelection(validator, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.disableCardSelection();

    // 5. コールバックを解除
    this.gameStore.clearCardSelectionCallback();

    return result;
  }

  async chooseRankForQueenBomber(): Promise<string> {
    // 1. コールバックを設定
    const resultPromise = new Promise<string>((resolve) => {
      this.gameStore.setQueenBomberRankCallback(resolve);
    });

    // 2. UI を表示
    this.gameStore.showQueenBomberRankSelectionUI();

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.hideQueenBomberRankSelectionUI();

    // 5. コールバックを解除
    this.gameStore.clearQueenBomberRankCallback();

    return result;
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      this.gameStore.setDiscardSelectionCallback(resolve);
    });

    // 2. UI を表示
    this.gameStore.enableDiscardSelection(discardPile, maxCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.disableDiscardSelection();

    // 5. コールバックを解除
    this.gameStore.clearDiscardSelectionCallback();

    return result;
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      this.gameStore.setExchangeSelectionCallback(resolve);
    });

    // 2. UI を表示
    this.gameStore.enableExchangeSelection(handCards, exactCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.disableExchangeSelection();

    // 5. コールバックを解除
    this.gameStore.clearExchangeSelectionCallback();

    return result;
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<string>((resolve) => {
      this.gameStore.setPlayerSelectionCallback(resolve);
    });

    // 2. UI を表示
    this.gameStore.enablePlayerSelection(playerIds, playerNames, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.disablePlayerSelection();

    // 5. コールバックを解除
    this.gameStore.clearPlayerSelectionCallback();

    return result;
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    // 捨て札選択UIを流用して対戦相手の手札を選択
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      this.gameStore.setDiscardSelectionCallback(resolve);
    });

    // 2. UI を表示（捨て札選択UIを流用）
    this.gameStore.enableDiscardSelection(cards, maxCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.disableDiscardSelection();

    // 5. コールバックを解除
    this.gameStore.clearDiscardSelectionCallback();

    return result;
  }

  async choosePlayer(players: Player[], prompt: string): Promise<Player | null> {
    // BlackMarket用のプレイヤー選択UIを流用
    const playerIds = players.map(p => p.id.value);
    const playerNames = new Map(players.map(p => [p.id.value, p.name]));

    // choosePlayerForBlackMarketと同じロジックを使用
    const resultId = await this.choosePlayerForBlackMarket(playerIds, playerNames, prompt);
    return players.find(p => p.id.value === resultId) || null;
  }

  async chooseCardRank(prompt: string): Promise<string> {
    // QueenBomber用のランク選択UIを流用
    // TODO: 専用のUIを作成する場合は分離する
    // 現在はQueenBomberのUI（クイーンボンバーUI）を流用

    // 1. コールバックを設定
    const resultPromise = new Promise<string>((resolve) => {
      this.gameStore.setQueenBomberRankCallback(resolve);
    });

    // 2. UI を表示（TODO: プロンプトを表示できるようにする）
    this.gameStore.showQueenBomberRankSelectionUI();

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.gameStore.hideQueenBomberRankSelectionUI();

    // 5. コールバックを解除
    this.gameStore.clearQueenBomberRankCallback();

    return result;
  }

  async choosePlayerOrder(players: Player[], prompt: string): Promise<Player[] | null> {
    // TODO: 専用のUIを作成する必要があるが、現在は順番にプレイヤーを選択させる
    // 暫定実装として、プレイヤー選択UIを繰り返し呼び出して順序を決定

    const orderedPlayers: Player[] = [];
    const remainingPlayers = [...players];

    for (let i = 0; i < players.length; i++) {
      const playerIds = remainingPlayers.map(p => p.id.value);
      const playerNames = new Map(remainingPlayers.map(p => [p.id.value, p.name]));

      const selectedId = await this.choosePlayerForBlackMarket(
        playerIds,
        playerNames,
        `${prompt}（${i + 1}/${players.length}番目を選択）`
      );

      const selectedPlayer = remainingPlayers.find(p => p.id.value === selectedId);
      if (selectedPlayer) {
        orderedPlayers.push(selectedPlayer);
        const index = remainingPlayers.indexOf(selectedPlayer);
        remainingPlayers.splice(index, 1);
      }
    }

    return orderedPlayers;
  }

  async chooseCountdownValue(min: number, max: number): Promise<number> {
    // TODO: 専用のUIを作成する必要がある
    // 暫定実装として、中央値を返す
    return Math.floor((min + max) / 2);
  }
}
