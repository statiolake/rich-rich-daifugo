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
      '革命': 1000,
      '大革命': 1500,
      '大革命＋即勝利': 2000,
      '11バック': 800,
      '8切り': 800,
      '4止め': 600,
      '5スキップ': 600,
      '7渡し': 600,
      '9リバース': 600,
      '10捨て': 600,
      'ジョーカー': 1000,
      '救急車': 1000,
      'クイーンボンバー': 1000,
      'ろくろ首': 1000,
      'ラッキーセブン': 1500,
      'マークしばり': 800,
      '数字しばり': 800,
      '縛り返し': 800,
    };

    return durationMap[effect] || 800; // デフォルト800ms
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
