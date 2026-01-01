import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
import { Player } from '../../core/domain/player/Player';
import { useGameStore } from '../store/gameStore';

/**
 * 人間プレイヤー用のコントローラー
 * UI経由でカード選択とランク選択を行う
 *
 * 注意: Zustandストアへのアクセスは常にuseGameStore.getState()を使用し、
 * スナップショットではなく最新の状態を取得すること。
 */
export class HumanPlayerController implements PlayerController {
  constructor(
    protected playerId: string
  ) {}

  /**
   * 最新のストア状態を取得
   */
  protected getStore() {
    return useGameStore.getState();
  }

  async chooseCardsInHand(validator: Validator, prompt?: string): Promise<Card[]> {
    const store = this.getStore();

    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      store.setCardSelectionCallback(resolve);
    });

    // 2. UI を表示（validator を渡して、有効なカードのみハイライト）
    store.enableCardSelection(validator, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().disableCardSelection();

    // 5. コールバックを解除
    this.getStore().clearCardSelectionCallback();

    return result;
  }

  async chooseRankForQueenBomber(): Promise<string> {
    const store = this.getStore();

    // 1. コールバックを設定
    const resultPromise = new Promise<string>((resolve) => {
      store.setQueenBomberRankCallback(resolve);
    });

    // 2. UI を表示
    store.showQueenBomberRankSelectionUI();

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().hideQueenBomberRankSelectionUI();

    // 5. コールバックを解除
    this.getStore().clearQueenBomberRankCallback();

    return result;
  }

  async chooseCardsFromDiscard(discardPile: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const store = this.getStore();

    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      store.setDiscardSelectionCallback(resolve);
    });

    // 2. UI を表示
    store.enableDiscardSelection(discardPile, maxCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().disableDiscardSelection();

    // 5. コールバックを解除
    this.getStore().clearDiscardSelectionCallback();

    return result;
  }

  async chooseCardsForExchange(handCards: Card[], exactCount: number, prompt: string): Promise<Card[]> {
    const store = this.getStore();

    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      store.setExchangeSelectionCallback(resolve);
    });

    // 2. UI を表示
    store.enableExchangeSelection(handCards, exactCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().disableExchangeSelection();

    // 5. コールバックを解除
    this.getStore().clearExchangeSelectionCallback();

    return result;
  }

  async choosePlayerForBlackMarket(
    playerIds: string[],
    playerNames: Map<string, string>,
    prompt: string
  ): Promise<string> {
    const store = this.getStore();

    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<string>((resolve) => {
      store.setPlayerSelectionCallback(resolve);
    });

    // 2. UI を表示
    store.enablePlayerSelection(playerIds, playerNames, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().disablePlayerSelection();

    // 5. コールバックを解除
    this.getStore().clearPlayerSelectionCallback();

    return result;
  }

  async chooseCardsFromOpponentHand(cards: Card[], maxCount: number, prompt: string): Promise<Card[]> {
    const store = this.getStore();

    // 捨て札選択UIを流用して対戦相手の手札を選択
    // 1. コールバックを設定（Promise を作成）
    const resultPromise = new Promise<Card[]>((resolve) => {
      store.setDiscardSelectionCallback(resolve);
    });

    // 2. UI を表示（捨て札選択UIを流用）
    store.enableDiscardSelection(cards, maxCount, prompt);

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().disableDiscardSelection();

    // 5. コールバックを解除
    this.getStore().clearDiscardSelectionCallback();

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
    const store = this.getStore();

    // QueenBomber用のランク選択UIを流用
    // TODO: 専用のUIを作成する場合は分離する
    // 現在はQueenBomberのUI（クイーンボンバーUI）を流用

    // 1. コールバックを設定
    const resultPromise = new Promise<string>((resolve) => {
      store.setQueenBomberRankCallback(resolve);
    });

    // 2. UI を表示（TODO: プロンプトを表示できるようにする）
    store.showQueenBomberRankSelectionUI();

    // 3. ユーザーの選択を待機
    const result = await resultPromise;

    // 4. UI を非表示
    this.getStore().hideQueenBomberRankSelectionUI();

    // 5. コールバックを解除
    this.getStore().clearQueenBomberRankCallback();

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
