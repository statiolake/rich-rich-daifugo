import { GameState, GamePhaseType } from '../domain/game/GameState';

export interface GamePhase {
  readonly type: GamePhaseType;

  /**
   * フェーズ開始時の処理
   */
  enter(gameState: GameState): Promise<void>;

  /**
   * フェーズの更新処理
   * @returns 次のフェーズタイプ、またはnull（継続）
   */
  update(gameState: GameState): Promise<GamePhaseType | null>;

  /**
   * フェーズ終了時の処理
   */
  exit(gameState: GameState): Promise<void>;
}
