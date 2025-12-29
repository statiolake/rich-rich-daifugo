import { PlayerController, Validator } from '../../core/domain/player/PlayerController';
import { Card } from '../../core/domain/card/Card';
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
}
