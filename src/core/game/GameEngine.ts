import { GameConfig } from './GameConfig';
import { GameState, GamePhaseType, createGameState } from '../domain/game/GameState';
import { GamePhase } from '../phase/GamePhase';
import { SetupPhase } from '../phase/SetupPhase';
import { PlayPhase } from '../phase/PlayPhase';
import { ResultPhase } from '../phase/ResultPhase';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { createPlayer, Player } from '../domain/player/Player';
import { Card } from '../domain/card/Card';

export class GameEngine {
  private gameState: GameState;
  private phases: Map<GamePhaseType, GamePhase>;
  private currentPhase: GamePhase;
  private eventEmitter: GameEventEmitter;
  private strategyMap: Map<string, PlayerStrategy>;
  private ruleEngine: RuleEngine;

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

  /**
   * ゲームを初期化する（同期的）
   * SETUP フェーズに入り、カードを配布してから PLAY フェーズに移行する
   */
  initialize(): void {
    // SETUP フェーズに入る（カード配布など）
    this.currentPhase.enter(this.gameState);
    this.eventEmitter.emit('game:started', { gameState: this.getState() });

    // PLAY フェーズに移行
    this.transitionPhase(GamePhaseType.PLAY);

    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * プレイを実行（同期的）
   * @param playerId プレイヤーID
   * @param cards プレイするカード
   */
  executePlay(playerId: string, cards: Card[]): void {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];

    // プレイヤー検証
    if (currentPlayer.id.value !== playerId) {
      throw new Error('Not your turn');
    }

    if (currentPlayer.isFinished) {
      throw new Error('Player already finished');
    }

    // PlayPhase.handlePlaySync() を呼び出す（同期的）
    const playPhase = this.currentPhase as PlayPhase;
    playPhase.handlePlaySync(this.gameState, currentPlayer, cards);

    // ゲーム終了チェック
    this.checkPhaseTransition();

    // 状態更新イベント
    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * パスを実行（同期的）
   * @param playerId プレイヤーID
   */
  executePass(playerId: string): void {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];

    if (currentPlayer.id.value !== playerId) {
      throw new Error('Not your turn');
    }

    const playPhase = this.currentPhase as PlayPhase;
    playPhase.handlePassSync(this.gameState, currentPlayer);

    this.checkPhaseTransition();
    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * 現在のプレイヤーを取得
   */
  getCurrentPlayer(): Player {
    return this.gameState.players[this.gameState.currentPlayerIndex];
  }

  /**
   * 指定プレイヤーの入力待ちか判定
   */
  isWaitingForPlayer(playerId: string): boolean {
    if (this.gameState.phase !== GamePhaseType.PLAY) {
      return false;
    }
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer.id.value === playerId && !currentPlayer.isFinished;
  }

  /**
   * 7渡し実行（同期的）
   * @param playerId プレイヤーID
   * @param card 渡すカード
   */
  executeSevenPass(playerId: string, card: Card): void {
    const player = this.gameState.players.find(p => p.id.value === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // pendingSpecialRule チェック
    if (!this.gameState.pendingSpecialRule || this.gameState.pendingSpecialRule.type !== 'sevenPass') {
      throw new Error('No pending seven pass');
    }

    const playPhase = this.currentPhase as PlayPhase;
    playPhase.executeSevenPassSync(this.gameState, player, card);

    // pendingSpecialRule をクリア
    this.gameState.pendingSpecialRule = undefined;

    this.checkPhaseTransition();
    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * 10捨て実行（同期的）
   * @param playerId プレイヤーID
   * @param card 捨てるカード
   */
  executeTenDiscard(playerId: string, card: Card): void {
    const player = this.gameState.players.find(p => p.id.value === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // pendingSpecialRule チェック
    if (!this.gameState.pendingSpecialRule || this.gameState.pendingSpecialRule.type !== 'tenDiscard') {
      throw new Error('No pending ten discard');
    }

    const playPhase = this.currentPhase as PlayPhase;
    playPhase.executeTenDiscardSync(this.gameState, player, card);

    // pendingSpecialRule をクリア
    this.gameState.pendingSpecialRule = undefined;

    this.checkPhaseTransition();
    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * クイーンボンバー実行（同期的）
   * @param playerId プレイヤーID
   * @param rank 指定ランク（最初の呼び出し）
   * @param cards 捨てるカード（2回目の呼び出し、省略可能）
   */
  executeQueenBomber(playerId: string, rank?: string, cards?: Card[]): void {
    const player = this.gameState.players.find(p => p.id.value === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // pendingSpecialRule チェック
    if (!this.gameState.pendingSpecialRule || this.gameState.pendingSpecialRule.type !== 'queenBomber') {
      throw new Error('No pending queen bomber');
    }

    const playPhase = this.currentPhase as PlayPhase;
    playPhase.executeQueenBomberSync(this.gameState, player, rank, cards);

    // ランク選択が完了したかチェック
    if (this.gameState.pendingSpecialRule?.context?.selectedRank && cards) {
      // 全プレイヤーのカード選択が完了したら pendingSpecialRule をクリア
      this.gameState.pendingSpecialRule = undefined;
    }

    this.checkPhaseTransition();
    this.eventEmitter.emit('state:updated', { gameState: this.getState() });
  }

  /**
   * フェーズ遷移チェック
   */
  private checkPhaseTransition(): void {
    const remainingPlayers = this.gameState.players.filter(p => !p.isFinished).length;

    if (remainingPlayers <= 1) {
      this.transitionPhase(GamePhaseType.RESULT);
      this.eventEmitter.emit('game:ended', { gameState: this.getState() });
    }
  }

  private transitionPhase(nextPhaseType: GamePhaseType): void {
    const fromPhase = this.currentPhase.type;

    this.currentPhase.exit(this.gameState);

    this.gameState.phase = nextPhaseType;
    this.currentPhase = this.phases.get(nextPhaseType)!;

    this.currentPhase.enter(this.gameState);

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
}
