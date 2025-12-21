import { Player, PlayerType } from './Player';
import { GameState } from '../game/GameState';

/**
 * ローカルプレイヤー（人間が操作するプレイヤー）に関するクエリサービス
 * 単一責任: ローカルプレイヤーの検索と判定のみを担当
 */
export class LocalPlayerService {
  /**
   * ローカルプレイヤーを取得
   * 現在は PlayerType.HUMAN で判定、将来は localPlayerIds セットで判定可能
   */
  static findLocalPlayer(gameState: GameState): Player | undefined {
    return gameState.players.find(p => p.type === PlayerType.HUMAN);
  }

  /**
   * 指定プレイヤーがローカル操作可能か判定
   */
  static isLocalPlayer(player: Player, gameState: GameState): boolean {
    const localPlayer = this.findLocalPlayer(gameState);
    return localPlayer?.id.value === player.id.value;
  }

  /**
   * ローカルプレイヤーのIDを取得
   */
  static getLocalPlayerId(gameState: GameState): string | undefined {
    return this.findLocalPlayer(gameState)?.id.value;
  }
}
