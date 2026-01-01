/**
 * PlayerControllerFactory
 *
 * プレイヤータイプとネットワークロールに基づいて
 * 適切な PlayerController を作成する。
 */

import { Card } from '../../core/domain/card/Card';
import { Player, PlayerType } from '../../core/domain/player/Player';
import { PlayerController } from '../../core/domain/player/PlayerController';
import { GameState } from '../../core/domain/game/GameState';
import { GameEventEmitter } from '../../core/domain/events/GameEventEmitter';
import { HumanPlayerController } from '../../presentation/players/HumanPlayerController';
import { CPUPlayerController } from '../../presentation/players/CPUPlayerController';
import { GuestPlayerController } from '../../presentation/players/GuestPlayerController';
import { NetworkInputController } from '../../core/player-controller/NetworkInputController';
import { SyncPlayerController } from '../../core/player-controller/SyncPlayerController';
import { CPUStrategy } from '../../core/strategy/PlayerStrategy';
import { GuestMessage } from '../../infrastructure/network/NetworkProtocol';

/**
 * ネットワークタイプ
 */
export type NetworkType = 'LOCAL' | 'HOST_LOCAL' | 'GUEST' | 'CPU';

/**
 * プレイヤーコントローラー設定
 */
export interface PlayerControllerConfig {
  playerId: string;
  playerType: PlayerType;
  networkType: NetworkType;
  strategy?: CPUStrategy;
}

/**
 * 依存オブジェクト
 */
export interface PlayerControllerDependencies {
  eventBus?: GameEventEmitter;
  cardResolver?: (cardIds: string[]) => Card[];
  sendToHost?: (message: GuestMessage) => void;
  player?: Player;
  gameState?: GameState;
}

/**
 * ファクトリー結果
 */
export interface PlayerControllerFactoryResult {
  controller: PlayerController;
  networkController?: NetworkInputController;
}

/**
 * PlayerControllerFactory
 *
 * プレイヤーの種類とネットワークロールに応じて適切なコントローラーを作成する。
 */
export class PlayerControllerFactory {
  /**
   * シングルプレイヤーゲーム用のコントローラーを作成
   */
  static createForSinglePlayer(
    config: PlayerControllerConfig,
    deps: PlayerControllerDependencies
  ): PlayerControllerFactoryResult {
    const { playerId, playerType, strategy } = config;

    if (playerType === PlayerType.HUMAN) {
      return { controller: new HumanPlayerController(playerId) };
    }

    // CPU - player と gameState が必要
    if (!deps.player || !deps.gameState || !strategy) {
      throw new Error('CPU controller requires player, gameState, and strategy');
    }

    return {
      controller: new CPUPlayerController(strategy, deps.player, deps.gameState),
    };
  }

  /**
   * ホスト側マルチプレイヤーゲーム用のコントローラーを作成
   * すべてのコントローラーは SyncPlayerController でラップされる
   */
  static createForHost(
    config: PlayerControllerConfig,
    deps: PlayerControllerDependencies
  ): PlayerControllerFactoryResult {
    const { playerId, networkType, strategy } = config;
    const { eventBus, cardResolver, player, gameState } = deps;

    if (!eventBus) {
      throw new Error('Host controllers require eventBus');
    }

    switch (networkType) {
      case 'HOST_LOCAL': {
        // ホスト自身（ローカル人間プレイヤー）
        const humanController = new HumanPlayerController(playerId);
        return {
          controller: new SyncPlayerController(playerId, humanController, eventBus),
        };
      }

      case 'GUEST': {
        // リモートゲストプレイヤー
        if (!cardResolver) {
          throw new Error('Guest controller requires cardResolver');
        }
        const networkController = new NetworkInputController(playerId);
        networkController.setCardResolver(cardResolver);
        return {
          controller: new SyncPlayerController(playerId, networkController, eventBus),
          networkController,
        };
      }

      case 'CPU': {
        // CPU プレイヤー
        if (!player || !gameState || !strategy) {
          throw new Error('CPU controller requires player, gameState, and strategy');
        }
        const cpuController = new CPUPlayerController(strategy, player, gameState);
        return {
          controller: new SyncPlayerController(playerId, cpuController, eventBus),
        };
      }

      default:
        throw new Error(`Unknown network type: ${networkType}`);
    }
  }

  /**
   * ゲスト側マルチプレイヤーゲーム用のコントローラーを作成
   */
  static createForGuest(
    config: PlayerControllerConfig,
    deps: PlayerControllerDependencies,
    isLocalPlayer: boolean
  ): PlayerControllerFactoryResult {
    const { playerId } = config;
    const { cardResolver, sendToHost } = deps;

    if (isLocalPlayer) {
      // 自分（ゲスト）のコントローラー
      if (!sendToHost) {
        throw new Error('Guest local controller requires sendToHost');
      }
      return {
        controller: new GuestPlayerController(playerId, sendToHost),
      };
    }

    // 他プレイヤー（ACTION_PERFORMED を待機）
    if (!cardResolver) {
      throw new Error('Remote controller requires cardResolver');
    }
    const networkController = new NetworkInputController(playerId);
    networkController.setCardResolver(cardResolver);
    return {
      controller: networkController,
      networkController,
    };
  }
}
