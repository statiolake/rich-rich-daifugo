import { GameConfig } from './GameConfig';
import { GameState, GamePhaseType, createGameState } from '../domain/game/GameState';
import { GamePhase } from '../phase/GamePhase';
import { SetupPhase } from '../phase/SetupPhase';
import { PlayPhase } from '../phase/PlayPhase';
import { ResultPhase } from '../phase/ResultPhase';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { PlayValidator } from '../rules/basic/PlayValidator';
import { EventBus } from '../../application/services/EventBus';
import { createPlayer } from '../domain/player/Player';

export class GameEngine {
  private gameState: GameState;
  private phases: Map<GamePhaseType, GamePhase>;
  private currentPhase: GamePhase;
  private eventBus: EventBus;
  private strategyMap: Map<string, PlayerStrategy>;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: GameConfig, eventBus: EventBus) {
    this.eventBus = eventBus;
    this.strategyMap = new Map();

    // プレイヤーを作成し、戦略をマップに登録
    const players = config.players.map(pConfig => {
      this.strategyMap.set(pConfig.id, pConfig.strategy);
      return createPlayer(pConfig.id, pConfig.name, pConfig.type);
    });

    this.gameState = createGameState(players);

    // フェーズを初期化
    const validator = new PlayValidator();
    this.phases = new Map<GamePhaseType, GamePhase>([
      [GamePhaseType.SETUP, new SetupPhase()],
      [GamePhaseType.PLAY, new PlayPhase(this.strategyMap, validator)],
      [GamePhaseType.RESULT, new ResultPhase()],
    ]);

    this.currentPhase = this.phases.get(GamePhaseType.SETUP)!;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Game is already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;

    try {
      await this.currentPhase.enter(this.gameState);
      this.eventBus.emit('game:started', { gameState: this.getState() });
      this.eventBus.emit('state:updated', { gameState: this.getState() });

      await this.runGameLoop();
    } catch (error) {
      console.error('Error in game loop:', error);
      this.isRunning = false;
      throw error;
    }
  }

  stop(): void {
    this.shouldStop = true;
    this.isRunning = false;
  }

  private async runGameLoop(): Promise<void> {
    while (this.gameState.phase !== GamePhaseType.RESULT && !this.shouldStop) {
      // 現在のフェーズを更新
      const nextPhaseType = await this.currentPhase.update(this.gameState);

      // 状態が更新されたことを通知
      this.eventBus.emit('state:updated', { gameState: this.getState() });

      // フェーズ遷移が必要な場合
      if (nextPhaseType) {
        await this.transitionPhase(nextPhaseType);
      }

      // UIの更新を待つ（フレーム単位で動作）
      await this.waitForFrame();
    }

    // 結果フェーズに入ったら一度だけ更新を実行
    if (this.gameState.phase === GamePhaseType.RESULT) {
      await this.currentPhase.update(this.gameState);
      this.eventBus.emit('state:updated', { gameState: this.getState() });
      this.eventBus.emit('game:ended', { gameState: this.getState() });
    }

    this.isRunning = false;
  }

  private async transitionPhase(nextPhaseType: GamePhaseType): Promise<void> {
    const fromPhase = this.currentPhase.type;

    await this.currentPhase.exit(this.gameState);

    this.gameState.phase = nextPhaseType;
    this.currentPhase = this.phases.get(nextPhaseType)!;

    await this.currentPhase.enter(this.gameState);

    this.eventBus.emit('phase:changed', {
      from: fromPhase,
      to: nextPhaseType,
      gameState: this.getState(),
    });
  }

  getState(): Readonly<GameState> {
    return this.gameState;
  }

  getStrategyMap(): ReadonlyMap<string, PlayerStrategy> {
    return this.strategyMap;
  }

  isGameRunning(): boolean {
    return this.isRunning;
  }

  private async waitForFrame(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for better UX
  }
}
