import { GameConfig } from './GameConfig';
import { GameState, GamePhaseType, createGameState } from '../domain/game/GameState';
import { GamePhase } from '../phase/GamePhase';
import { SetupPhase } from '../phase/SetupPhase';
import { PlayPhase } from '../phase/PlayPhase';
import { ResultPhase } from '../phase/ResultPhase';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { createPlayer } from '../domain/player/Player';
import { Card } from '../domain/card/Card';
import { HumanStrategy } from '../strategy/HumanStrategy';

export class GameEngine {
  private gameState: GameState;
  private phases: Map<GamePhaseType, GamePhase>;
  private currentPhase: GamePhase;
  private eventEmitter: GameEventEmitter;
  private strategyMap: Map<string, PlayerStrategy>;
  private ruleEngine: RuleEngine;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: GameConfig, eventEmitter: GameEventEmitter) {
    this.eventEmitter = eventEmitter;
    this.strategyMap = new Map();

    // プレイヤーを作成し、戦略をマップに登録
    const players = config.players.map(pConfig => {
      this.strategyMap.set(pConfig.id, pConfig.strategy);
      return createPlayer(pConfig.id, pConfig.name, pConfig.type);
    });

    this.gameState = createGameState(players, config.ruleSettings);

    // RuleEngine を初期化
    this.ruleEngine = new RuleEngine();

    // Strategy に RuleEngine を設定
    for (const strategy of this.strategyMap.values()) {
      if ('setRuleEngine' in strategy && typeof strategy.setRuleEngine === 'function') {
        strategy.setRuleEngine(this.ruleEngine);
      }
    }

    // フェーズを初期化
    const playPhase = new PlayPhase(this.strategyMap, this.ruleEngine, this.eventEmitter);
    this.phases = new Map<GamePhaseType, GamePhase>([
      [GamePhaseType.SETUP, new SetupPhase()],
      [GamePhaseType.PLAY, playPhase],
      [GamePhaseType.RESULT, new ResultPhase()],
    ]);

    this.currentPhase = this.phases.get(GamePhaseType.SETUP)!;
  }

  setWaitForCutIn(fn: () => Promise<void>): void {
    const playPhase = this.phases.get(GamePhaseType.PLAY) as PlayPhase;
    if (playPhase) {
      playPhase.setWaitForCutIn(fn);
    }
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
      this.eventEmitter.emit('game:started', { gameState: this.getState() });
      this.eventEmitter.emit('state:updated', { gameState: this.getState() });

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
      this.eventEmitter.emit('state:updated', { gameState: this.getState() });

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
      this.eventEmitter.emit('state:updated', { gameState: this.getState() });
      this.eventEmitter.emit('game:ended', { gameState: this.getState() });
    }

    this.isRunning = false;
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

  getStrategyMap(): ReadonlyMap<string, PlayerStrategy> {
    return this.strategyMap;
  }

  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }

  isGameRunning(): boolean {
    return this.isRunning;
  }

  /**
   * カード選択を処理する（7渡し、10捨て、クイーンボンバー用）
   * HumanPlayerの場合、HumanStrategyのsubmitCardSelectionを呼び出す
   */
  handleCardSelection(playerId: string, selectedCards: Card[]): void {
    if (this.gameState.phase !== GamePhaseType.PLAY) {
      return;
    }

    const strategy = this.strategyMap.get(playerId);
    if (!strategy) {
      console.error(`Strategy not found for player ${playerId}`);
      return;
    }

    // HumanStrategyの場合、submitCardSelectionを呼び出してPromiseを解決
    if (strategy instanceof HumanStrategy) {
      strategy.submitCardSelection(selectedCards);
      // state:updatedは、PlayPhaseのupdate()内のhandleCardSelection呼び出し後に発火される
    }
  }

  private async waitForFrame(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for better UX
  }
}
