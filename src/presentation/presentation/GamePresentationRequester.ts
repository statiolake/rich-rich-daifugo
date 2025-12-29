import { PresentationRequester, CutIn } from '../../core/domain/presentation/PresentationRequester';
import { useGameStore } from '../store/gameStore';

type GameStore = ReturnType<typeof useGameStore.getState>;

/**
 * プレゼンテーション層の実装
 * コア層のインターフェースを実装し、実際のUI表示を行う
 */
export class GamePresentationRequester implements PresentationRequester {
  constructor(private gameStore: GameStore) {}

  /**
   * エフェクトに応じた表示時間を決定（プレゼンテーション層の責務）
   */
  private getDuration(effect: string): number {
    const durationMap: Record<string, number> = {
      '革命': 500,
      '革命終了': 500,
      '階段革命': 500,
      '階段革命終了': 500,
      'ナナサン革命': 500,
      'ナナサン革命終了': 500,
      '大革命': 750,
      '大革命＋即勝利': 1000,
      '11バック': 400,
      '8切り': 400,
      '4止め': 300,
      '5スキップ': 300,
      '7渡し': 300,
      '9リバース': 300,
      '10捨て': 300,
      'ジョーカー': 500,
      '救急車': 500,
      'クイーンボンバー': 500,
      'ろくろ首': 500,
      'ラッキーセブン': 750,
      'マークしばり': 400,
      '数字しばり': 400,
      '激縛り': 400,
      '色縛り': 400,
      'Q解き': 400,
      '6戻し': 400,
      '縛り返し': 400,
    };

    return durationMap[effect] || 400; // デフォルト400ms
  }

  /**
   * エフェクトに応じた表示テキストを決定（プレゼンテーション層の責務）
   */
  private getText(effect: string): string {
    return `${effect}！`;
  }

  async requestCutIns(cutIns: CutIn[]): Promise<void> {
    // すべてのカットインをキューに追加
    for (const cutIn of cutIns) {
      await this.gameStore.enqueueCutIn({
        id: `${cutIn.effect}-${Date.now()}`,
        text: this.getText(cutIn.effect),
        variant: cutIn.variant,
        duration: this.getDuration(cutIn.effect),
      });
    }
  }
}
