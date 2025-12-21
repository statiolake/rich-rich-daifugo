import { GameConfig } from './GameConfig';
import { PlayerType } from '../domain/player/Player';
import { HumanStrategy } from '../strategy/HumanStrategy';
import { RandomCPUStrategy } from '../strategy/RandomCPUStrategy';

export class GameConfigFactory {
  /**
   * 標準的なゲーム設定を生成
   * @param playerCount 総プレイヤー数（2-5人）
   * @param humanPlayerCount 人間プレイヤー数（0-playerCount）
   * @param playerName 最初の人間プレイヤーの名前
   */
  static createStandardGame(
    playerCount: number = 4,
    humanPlayerCount: number = 1,
    playerName: string = 'あなた'
  ): GameConfig {
    const playerConfigs = [];

    // 人間プレイヤー
    for (let i = 0; i < humanPlayerCount; i++) {
      playerConfigs.push({
        id: `player-${i}`,
        name: i === 0 ? playerName : `プレイヤー${i + 1}`,
        type: PlayerType.HUMAN,
        strategy: new HumanStrategy(),
      });
    }

    // CPUプレイヤー
    for (let i = humanPlayerCount; i < playerCount; i++) {
      playerConfigs.push({
        id: `player-${i}`,
        name: `CPU ${i - humanPlayerCount + 1}`,
        type: PlayerType.CPU,
        strategy: new RandomCPUStrategy(),
      });
    }

    return {
      players: playerConfigs,
    };
  }

  /**
   * CPU観戦モード用の設定（将来の拡張用）
   */
  static createCPUOnlyGame(playerCount: number = 4): GameConfig {
    return this.createStandardGame(playerCount, 0);
  }
}
