import { Card } from '../card/Card';

/**
 * カットイン情報（コア層の関心事のみ）
 * duration などの表示時間はプレゼンテーション層が決定
 */
export interface CutIn {
  /**
   * カットインのエフェクト名（例: '革命', '大革命', 'ラッキーセブン'）
   */
  effect: string;

  /**
   * カットインの色バリアント（重要度を表現）
   */
  variant: 'gold' | 'red' | 'blue' | 'green' | 'yellow';
}

/**
 * ゲームログ情報
 */
export interface GameLog {
  type: 'play' | 'pass' | 'effect' | 'system' | 'finish';
  playerName?: string;
  message: string;
  cards?: Card[];
  effectNames?: string[]; // 発動したエフェクト名の配列
}

/**
 * プレゼンテーション要求インターフェース
 * コア層からプレゼンテーション層へのUI表示要求を抽象化
 */
export interface PresentationRequester {
  /**
   * カットイン表示を要求
   * すべてのカットインが表示完了するまで待機
   * 表示時間（duration）や表示テキストはプレゼンテーション層が決定
   */
  requestCutIns(cutIns: CutIn[]): Promise<void>;

  /**
   * ゲームログを追加
   */
  addLog(log: GameLog): void;
}
