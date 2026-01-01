import { GameConfig } from './GameConfig';
import { GameState, GamePhaseType, createGameState } from '../domain/game/GameState';
import { Field } from '../domain/game/Field';
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
    console.log('[GameEngine] Starting game...');
    // SETUP フェーズ
    await this.currentPhase.enter(this.gameState);
    console.log('[GameEngine] SETUP phase completed, emitting game:started');
    this.eventEmitter.emit('game:started', { gameState: this.getState() });
    console.log('[GameEngine] game:started event emitted');

    // EXCHANGE フェーズに移行（2ラウンド目以降はカード交換が発生）
    await this.transitionPhase(GamePhaseType.EXCHANGE);

    // PLAY フェーズに移行
    await this.transitionPhase(GamePhaseType.PLAY);

    // ゲームループ
    await this.runPlayLoop();

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

  /**
   * ゲスト用: 初期状態を設定
   * ホストから受信した初期状態でGameStateを上書き
   */
  setInitialState(state: GameState): void {
    this.gameState = state;
  }

  /**
   * ゲスト用: PlayPhaseからゲームを開始
   * ホストから初期状態を受信済みの前提で、PlayPhaseのループを開始する
   */
  async startFromPlayPhase(): Promise<void> {
    // 現在のフェーズをPlayPhaseに設定
    this.gameState.phase = GamePhaseType.PLAY;
    this.currentPhase = this.phases.get(GamePhaseType.PLAY)!;

    console.log('[Guest] Starting game from PlayPhase');

    // PlayPhaseに入る（enterは呼ばない - ホスト側で既に処理済み）
    // ゲームループを開始
    await this.runPlayLoop();

    this.eventEmitter.emit('game:ended', { gameState: this.getState() });
  }

  /**
   * イベントエミッターを取得
   */
  getEventEmitter(): GameEventEmitter {
    return this.eventEmitter;
  }

  /**
   * 次のラウンドを開始
   * ランクを引き継いで新しいラウンドを開始する
   */
  async startNextRound(): Promise<void> {
    // ラウンド数を増やす
    this.gameState.round++;

    // プレイヤーの状態をリセット（ランクは引き継ぎ）
    for (const player of this.gameState.players) {
      player.isFinished = false;
      player.finishPosition = null;
      // ランクはそのまま（都落ち等で変更されたものを含む）
    }

    // ゲーム状態をリセット（ランクや都落ち情報は維持）
    this.resetGameStateForNextRound();

    // SETUP フェーズからやり直し
    this.gameState.phase = GamePhaseType.SETUP;
    this.currentPhase = this.phases.get(GamePhaseType.SETUP)!;
    await this.currentPhase.enter(this.gameState);

    // EXCHANGE フェーズに移行（2ラウンド目以降なのでカード交換が発生）
    await this.transitionPhase(GamePhaseType.EXCHANGE);

    // PLAY フェーズに移行
    await this.transitionPhase(GamePhaseType.PLAY);

    // ゲームループ（startメソッドと同じロジック）
    await this.runPlayLoop();

    this.eventEmitter.emit('game:ended', { gameState: this.getState() });
  }

  /**
   * PLAYフェーズのゲームループを実行
   */
  private async runPlayLoop(): Promise<void> {
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
  }

  /**
   * 次のラウンド用にゲーム状態をリセット
   */
  private resetGameStateForNextRound(): void {
    // フィールドをクリア
    this.gameState.field = new Field();
    this.gameState.discardPile = [];

    // 動的ルール状態をリセット
    this.gameState.isRevolution = false;
    this.gameState.isElevenBack = false;
    this.gameState.elevenBackDuration = 0;
    this.gameState.isOmenActive = false;
    this.gameState.isSuperRevolutionActive = false;
    this.gameState.isReligiousRevolutionActive = false;
    this.gameState.oddEvenRestriction = null;
    this.gameState.isEightCutPending = false;
    this.gameState.suitLock = null;
    this.gameState.numberLock = false;
    this.gameState.colorLock = null;
    this.gameState.isReversed = false;
    this.gameState.isTwoBack = false;
    this.gameState.isDamianActive = false;
    this.gameState.luckySeven = null;
    this.gameState.parityRestriction = null;
    this.gameState.isTenFreeActive = false;
    this.gameState.isDoubleDigitSealActive = false;
    this.gameState.hotMilkRestriction = null;
    this.gameState.isArthurActive = false;
    this.gameState.deathSentenceTarget = null;
    this.gameState.endCountdownValue = null;
    this.gameState.teleforceCountdown = null;
    this.gameState.partialLockSuits = null;
    this.gameState.excludedCards = [];
    this.gameState.supplyAidUsed = false;
    this.gameState.scavengingUsed = false;
    this.gameState.guillotineClockCount = null;
    this.gameState.passCount = 0;
    this.gameState.isNuclearBombActive = false;
    this.gameState.revolutionCount = 0;
    this.gameState.miyakoOchiAttackerId = null;
    this.gameState.isFirstTurn = true;
    this.gameState.hasDaifugoPassedFirst = false;
    // murahachibuTargetId は ResultPhase で設定され、SetupPhase で消費されるので保持

    // 最初のプレイヤーを設定（大貧民が親になる場合がある）
    const daihinmin = this.gameState.players.find(p => p.rank === 'DAIHINMIN');
    if (daihinmin) {
      this.gameState.currentPlayerIndex = this.gameState.players.indexOf(daihinmin);
    } else {
      this.gameState.currentPlayerIndex = 0;
    }
  }
}
