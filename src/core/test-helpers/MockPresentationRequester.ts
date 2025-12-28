import { PresentationRequester, CutIn } from '../domain/presentation/PresentationRequester';

/**
 * テスト用のモック PresentationRequester
 * カットイン表示を記録するだけで実際の表示は行わない
 */
export class MockPresentationRequester implements PresentationRequester {
  public cutInHistory: CutIn[][] = [];

  async requestCutIns(cutIns: CutIn[]): Promise<void> {
    this.cutInHistory.push([...cutIns]);
  }

  /**
   * 最後に表示されたカットインを取得
   */
  getLastCutIns(): CutIn[] | undefined {
    return this.cutInHistory[this.cutInHistory.length - 1];
  }

  /**
   * すべてのカットイン履歴を取得
   */
  getAllCutIns(): CutIn[] {
    return this.cutInHistory.flat();
  }

  /**
   * 特定のエフェクトが表示されたかチェック
   */
  hasEffect(effect: string): boolean {
    return this.getAllCutIns().some(cutIn => cutIn.effect === effect);
  }

  /**
   * モックをリセット
   */
  reset(): void {
    this.cutInHistory = [];
  }
}
