import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';

export class ResultPhase implements GamePhase {
  readonly type = GamePhaseType.RESULT;

  async enter(gameState: GameState): Promise<void> {
    console.log('=== Game Results ===');

    // プレイヤーを順位順にソート
    const sortedPlayers = [...gameState.players].sort((a, b) => {
      return (a.finishPosition || 999) - (b.finishPosition || 999);
    });

    sortedPlayers.forEach(player => {
      console.log(`${player.finishPosition}. ${player.name} - ${player.rank}`);
    });

    console.log('====================');
  }

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    // 結果フェーズでは自動的に次のラウンドには進まない
    // UIから次のラウンドを開始するか、ゲームを終了するか選択させる
    // Phase 1ではここで停止
    return null;
  }

  async exit(gameState: GameState): Promise<void> {
    // クリーンアップ
  }
}
