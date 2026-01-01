import { PresentationRequester, CutIn, GameLog } from '../../core/domain/presentation/PresentationRequester';
import { useGameStore } from '../store/gameStore';
import { useCutInStore } from '../store/cutInStore';

type GameStore = ReturnType<typeof useGameStore.getState>;
type CutInStore = ReturnType<typeof useCutInStore.getState>;

/**
 * プレゼンテーション層の実装
 * コア層のインターフェースを実装し、実際のUI表示を行う
 */
export class GamePresentationRequester implements PresentationRequester {
  private cutInStore: CutInStore;

  constructor(private gameStore: GameStore) {
    this.cutInStore = useCutInStore.getState();
  }

  /**
   * ゲームログを追加
   */
  addLog(log: GameLog): void {
    this.gameStore.addGameLog(log);
  }

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
      'キングの行進': 500,
      'サルベージ': 500,
      '次期エース': 500,
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
    console.log('[DEBUG] requestCutIns called with:', cutIns.map(c => c.effect));

    if (cutIns.length === 0) return;

    // 最新のcutInStoreを取得（Zustandの状態は変わる可能性があるため）
    const cutInStore = useCutInStore.getState();

    // すべてのカットインを同時にキューに追加
    // enqueueCutInは各カットインが完了するまで待機するPromiseを返すので、
    // Promise.allで全部のカットインが完了するまで待機する
    const promises = cutIns.map((cutIn, index) =>
      cutInStore.enqueueCutIn({
        id: `${cutIn.effect}-${Date.now()}-${index}`,
        text: this.getText(cutIn.effect),
        variant: cutIn.variant,
        duration: this.getDuration(cutIn.effect),
      })
    );

    await Promise.all(promises);
  }
}
