import { GameConfig, PlayerConfig } from './GameConfig';
import { PlayerType } from '../domain/player/Player';
import { HumanStrategy } from '../strategy/HumanStrategy';
import { RandomCPUStrategy } from '../strategy/RandomCPUStrategy';
import { RuleSettings, DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';

/**
 * マルチプレイ用のプレイヤー情報
 */
export interface MultiplayerPlayerInfo {
  id: string;
  name: string;
  type: 'HOST' | 'GUEST' | 'CPU';
}

export class GameConfigFactory {
  /**
   * 標準的なゲーム設定を生成
   * @param playerCount 総プレイヤー数（2-5人）
   * @param humanPlayerCount 人間プレイヤー数（0-playerCount）
   * @param playerName 最初の人間プレイヤーの名前
   * @param ruleSettings ルール設定（省略時はデフォルト）
   */
  static createStandardGame(
    playerCount: number = 4,
    humanPlayerCount: number = 1,
    playerName: string = 'あなた',
    ruleSettings: RuleSettings = DEFAULT_RULE_SETTINGS
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
      ruleSettings: { ...ruleSettings },
    };
  }

  /**
   * CPU観戦モード用の設定（将来の拡張用）
   */
  static createCPUOnlyGame(playerCount: number = 4): GameConfig {
    return this.createStandardGame(playerCount, 0);
  }

  /**
   * マルチプレイ用のゲーム設定を生成
   * @param players マルチプレイのプレイヤー情報配列
   * @param localPlayerId ローカル（このクライアント）のプレイヤーID
   * @param ruleSettings ルール設定
   */
  static createMultiplayerGame(
    players: MultiplayerPlayerInfo[],
    localPlayerId: string,
    ruleSettings: RuleSettings = DEFAULT_RULE_SETTINGS
  ): GameConfig {
    const playerConfigs: PlayerConfig[] = players.map((p) => {
      // ローカルプレイヤー（HOST or GUEST）はHUMANタイプ
      // リモートのGUESTはHUMANタイプ（NetworkInputControllerで制御）
      // CPUはCPUタイプ
      const isLocalPlayer = p.id === localPlayerId;
      const type = p.type === 'CPU' ? PlayerType.CPU : PlayerType.HUMAN;
      const strategy = p.type === 'CPU' ? new RandomCPUStrategy() : new HumanStrategy();

      return {
        id: p.id,
        name: p.name,
        type,
        strategy,
        isLocal: isLocalPlayer,
        networkType: p.type,
      };
    });

    return {
      players: playerConfigs,
      ruleSettings: { ...ruleSettings },
    };
  }
}
