import { GameConfig } from './GameConfig';
import { GameState, GamePhaseType, createGameState } from '../domain/game/GameState';
import { GamePhase } from '../phase/GamePhase';
import { SetupPhase } from '../phase/SetupPhase';
import { ExchangePhase } from '../phase/ExchangePhase';
import { PlayPhase } from '../phase/PlayPhase';
import { ResultPhase } from '../phase/ResultPhase';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { createPlayer } from '../domain/player/Player';
import { PlayerController } from '../domain/player/PlayerController';
import { PresentationRequester } from '../domain/presentation/PresentationRequester';
import { RankAssignmentService } from '../phase/handlers/RankAssignmentService';

export class GameEngine {
  private gameState: GameState;
  private phases: Map<GamePhaseType, GamePhase>;
  private currentPhase: GamePhase;
  private eventEmitter: GameEventEmitter;
  private playerControllers: Map<string, PlayerController>;
  private ruleEngine: RuleEngine;
  private presentationRequester: PresentationRequester;

  constructor(
    config: GameConfig,
    eventEmitter: GameEventEmitter,
    presentationRequester: PresentationRequester,
    playerControllers: Map<string, PlayerController>
  ) {
    this.eventEmitter = eventEmitter;
    this.presentationRequester = presentationRequester;
    this.playerControllers = playerControllers;
    this.ruleEngine = new RuleEngine();

    // プレイヤーを作成
    const players = config.players.map(pConfig =>
      createPlayer(pConfig.id, pConfig.name, pConfig.type)
    );

    this.gameState = createGameState(players, config.ruleSettings);

    // PlayPhaseに必要な依存性を注入
    const playPhase = new PlayPhase(
      this.playerControllers,
      this.ruleEngine,
      this.eventEmitter,
      this.presentationRequester
    );

    // ExchangePhaseに必要な依存性を注入
    const exchangePhase = new ExchangePhase(
      this.playerControllers,
      this.presentationRequester
    );

    this.phases = new Map<GamePhaseType, GamePhase>([
      [GamePhaseType.SETUP, new SetupPhase()],
      [GamePhaseType.EXCHANGE, exchangePhase],
      [GamePhaseType.PLAY, playPhase],
      [GamePhaseType.RESULT, new ResultPhase()],
    ]);

    this.currentPhase = this.phases.get(GamePhaseType.SETUP)!;
  }

  /**
   * ゲームを開始（非同期ループ）
   */
  async start(): Promise<void> {
    // SETUP フェーズ
    await this.currentPhase.enter(this.gameState);
    this.eventEmitter.emit('game:started', { gameState: this.getState() });

    // EXCHANGE フェーズに移行（2ラウンド目以降はカード交換が発生）
    await this.transitionPhase(GamePhaseType.EXCHANGE);

    // PLAY フェーズに移行
    await this.transitionPhase(GamePhaseType.PLAY);

    // ゲームループ
    while (this.gameState.phase === GamePhaseType.PLAY) {
      await this.currentPhase.update(this.gameState);

      // フェーズ遷移チェック
      const remainingPlayers = this.gameState.players.filter(p => !p.isFinished).length;
      if (remainingPlayers <= 1) {
        // 最後のプレイヤーにランクを割り当て
        const lastPlayer = this.gameState.players.find(p => !p.isFinished);
        if (lastPlayer) {
          const finishedCount = this.gameState.players.filter(p => p.isFinished).length;
          lastPlayer.isFinished = true;
          lastPlayer.finishPosition = finishedCount + 1;
          const rankService = new RankAssignmentService();
          rankService.assignRank(this.gameState, lastPlayer);
        }
        await this.transitionPhase(GamePhaseType.RESULT);
      }

      // 状態更新イベント
      this.eventEmitter.emit('state:updated', { gameState: this.getState() });
    }

    this.eventEmitter.emit('game:ended', { gameState: this.getState() });
  }

  private async transitionPhase(nextPhaseType: GamePhaseType): Promise<void> {
    const fromPhase = this.currentPhase.type;

    await this.currentPhase.exit(this.gameState);

    this.gameState.phase = nextPhaseType;
    this.currentPhase = this.phases.get(nextPhaseType)!;

    await this.currentPhase.enter(this.gameState);

    this.eventEmitter.emit('phase:changed', {
      from: fromPhase,
      to: nextPhaseType,
      gameState: this.getState(),
    });
  }

  getState(): Readonly<GameState> {
    return this.gameState;
  }

  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }
}
