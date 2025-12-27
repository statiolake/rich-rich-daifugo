import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { Card } from '../domain/card/Card';
import { PlayAnalyzer } from '../domain/card/Play';
import { Player } from '../domain/player/Player';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { TriggerEffectAnalyzer, TriggerEffect } from '../rules/effects/TriggerEffectAnalyzer';
import { EffectHandler } from '../rules/effects/EffectHandler';
import { SpecialRuleExecutor } from './handlers/SpecialRuleExecutor';
import { ConstraintChecker } from './handlers/ConstraintChecker';
import { GameEndChecker } from './handlers/GameEndChecker';
import { RankAssignmentService } from './handlers/RankAssignmentService';

export class PlayPhase implements GamePhase {
  readonly type = GamePhaseType.PLAY;
  private waitForCutInFn?: () => Promise<void>;
  private effectAnalyzer: TriggerEffectAnalyzer;
  private effectHandler: EffectHandler;
  private specialRuleExecutor: SpecialRuleExecutor;
  private constraintChecker: ConstraintChecker;
  private gameEndChecker: GameEndChecker;
  private rankAssignmentService: RankAssignmentService;

  constructor(
    private strategyMap: Map<string, PlayerStrategy>,
    private ruleEngine: RuleEngine,
    private eventBus?: GameEventEmitter
  ) {
    this.effectAnalyzer = new TriggerEffectAnalyzer();
    this.effectHandler = new EffectHandler(eventBus);
    this.specialRuleExecutor = new SpecialRuleExecutor(strategyMap, eventBus);
    this.constraintChecker = new ConstraintChecker(eventBus);
    this.gameEndChecker = new GameEndChecker(ruleEngine);
    this.rankAssignmentService = new RankAssignmentService();
  }

  setWaitForCutIn(fn: () => Promise<void>): void {
    this.waitForCutInFn = fn;
    this.specialRuleExecutor.setWaitForCutIn(fn);
  }

  async enter(gameState: GameState): Promise<void> {
    this.clearFieldAndResetState(gameState, true);
    gameState.isReversed = false; // リバースをリセット

    // 初回ラウンドはランダムなプレイヤーから開始
    // 2回目以降は大富豪から開始（まだ実装していないので常にランダム）
    gameState.currentPlayerIndex = Math.floor(Math.random() * gameState.players.length);

    console.log(`Play phase started. Starting player: ${gameState.players[gameState.currentPlayerIndex].name}`);
  }

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // 既に上がっているプレイヤーはスキップ
    if (currentPlayer.isFinished) {
      this.nextPlayer(gameState);
      return null;
    }

    // プレイヤーの戦略を取得
    const strategy = this.strategyMap.get(currentPlayer.id.value);
    if (!strategy) {
      throw new Error(`Strategy not found for player ${currentPlayer.id.value}`);
    }

    // 戦略に基づいて行動決定
    const decision = await strategy.decidePlay(currentPlayer, gameState.field, gameState);

    if (decision.type === 'PLAY' && decision.cards) {
      await this.handlePlay(gameState, currentPlayer, decision.cards);
    } else {
      await this.handlePass(gameState, currentPlayer);
    }

    // ゲーム終了チェック
    const nextPhase = this.gameEndChecker.checkGameEnd(gameState, this.handlePlayerFinish.bind(this));
    if (nextPhase) {
      return nextPhase;
    }

    return null; // 継続
  }

  async exit(gameState: GameState): Promise<void> {
    console.log('Play phase ended');
  }

  private async handlePlay(
    gameState: GameState,
    player: Player,
    cards: Card[]
  ): Promise<void> {
    // 検証
    const validation = this.ruleEngine.validate(player, cards, gameState.field, gameState);
    if (!validation.valid) {
      console.error(`Invalid play by ${player.name}: ${validation.reason}`);
      // CPUの場合は自動的にパスさせる
      await this.handlePass(gameState, player);
      return;
    }

    const play = PlayAnalyzer.analyze(cards)!;

    // プレイを実行
    player.hand.remove(cards);
    gameState.field.addPlay(play, player.id);
    gameState.passCount = 0;

    console.log(`${player.name} played ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);

    // === エフェクトの検出と適用（リファクタリング済み） ===
    // エフェクトを分析（ドメイン層で一括検出）
    const effects = this.effectAnalyzer.analyze(play, gameState);

    // ラッキーセブンのリセット（新しいカードが出されたら、それがラッキーセブンでない限りリセット）
    if (gameState.luckySeven && !effects.includes('ラッキーセブン')) {
      console.log('ラッキーセブンが破られました');
      gameState.luckySeven = null;
    }

    // マークしばりチェック（ルール有効時のみ）
    this.constraintChecker.updateSuitLock(gameState, play);

    // 数字しばりチェック（ルール有効時のみ）
    this.constraintChecker.updateNumberLock(gameState, play);

    // === エフェクト適用（for-each パターン） ===
    // すべてのエフェクトに対してイベントを発火し、状態を更新
    for (const effect of effects) {
      this.applyEffect(effect, gameState, player);
    }

    // 全イベント発火後に1回だけ待機
    if (effects.length > 0 && this.waitForCutInFn) {
      console.log('[PlayPhase] Waiting for cut-in animations...');
      await this.waitForCutInFn();
      console.log('[PlayPhase] Cut-in animations completed, resuming game...');
    }

    // カットイン完了後にソート（XORロジック反映）
    if (effects.length > 0) {
      gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
    }

    // 8切りが発動中の場合、次のプレイで場をクリア（4止めで止められていない場合）
    let shouldClearFieldFromPreviousEightCut = false;
    if (gameState.isEightCutPending && !effects.includes('4止め')) {
      shouldClearFieldFromPreviousEightCut = true;
      console.log('8切りが発動します（前のプレイで8が出された）');
    }

    // 4止めが発動した場合、8切りフラグをクリア（場はクリアしない）
    if (effects.includes('4止め')) {
      console.log('4止めが発動しました！8切りを止めます');
      gameState.isEightCutPending = false;
    }

    // 8切り・救急車・ろくろ首の場合、場をクリア
    const shouldClearField =
      shouldClearFieldFromPreviousEightCut ||
      effects.includes('救急車') ||
      effects.includes('ろくろ首');

    if (shouldClearField) {
      this.handleLuckySevenVictory(gameState);
      this.clearFieldAndResetState(gameState);
    }

    // 場をクリアした場合は、手番を維持する（nextPlayerを呼ばない）
    const shouldKeepTurn = shouldClearField;

    // 大革命の即勝利処理
    if (effects.includes('大革命＋即勝利')) {
      // 残りの手札をすべて削除して即座に上がり
      const remainingCards = player.hand.getCards();
      if (remainingCards.length > 0) {
        player.hand.remove([...remainingCards]);
      }
      this.handlePlayerFinish(gameState, player);
      // 大革命で上がった場合は次のプレイヤーに進む
      if (!shouldKeepTurn) {
        this.nextPlayer(gameState);
      }
      return;
    }

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }

    // 7渡し判定（手札から1枚を次のプレイヤーに渡す）
    if (effects.includes('7渡し') && !player.hand.isEmpty()) {
      await this.specialRuleExecutor.executeSevenPass(gameState, player, this.handlePlayerFinish.bind(this));
    }

    // 10捨て判定（手札から1枚を捨てる）
    if (effects.includes('10捨て') && !player.hand.isEmpty()) {
      await this.specialRuleExecutor.executeTenDiscard(gameState, player, this.handlePlayerFinish.bind(this));
    }

    // クイーンボンバー判定（全員が指定されたカードを捨てる）
    if (effects.includes('クイーンボンバー')) {
      await this.specialRuleExecutor.executeQueenBomber(gameState, player, this.handlePlayerFinish.bind(this));
    }

    // 5スキップ判定
    const shouldSkipNext = effects.includes('5スキップ');

    // 場をクリアした場合は手番を維持する（nextPlayerを呼ばない）
    if (!shouldKeepTurn) {
      this.nextPlayer(gameState);

      // 5スキップの場合は、さらにもう1人スキップ
      if (shouldSkipNext) {
        this.nextPlayer(gameState);
      }
    }
  }

  private async handlePass(gameState: GameState, player: Player): Promise<void> {
    console.log(`${player.name} passed`);

    gameState.passCount++;

    // 全員がパスした場合の処理
    const activePlayers = gameState.players.filter(p => !p.isFinished).length;
    if (gameState.passCount >= activePlayers - 1) {
      // 場が空の状態で全員がパスした場合のみ、誰も出せないかチェック
      if (gameState.field.isEmpty() && !this.gameEndChecker.canAnyonePlay(gameState)) {
        console.log('全員が出せる手がないため、ゲームを終了します');
        this.gameEndChecker.endGameDueToNoPlays(gameState, this.rankAssignmentService.assignRank.bind(this.rankAssignmentService));
        return;
      }

      this.handleLuckySevenVictory(gameState);
      this.clearFieldAndResetState(gameState);
    }

    this.nextPlayer(gameState);
  }

  private handlePlayerFinish(gameState: GameState, player: Player): void {
    const finishedCount = gameState.players.filter(p => p.isFinished).length;
    player.isFinished = true;
    player.finishPosition = finishedCount + 1;

    console.log(`${player.name} finished in position ${player.finishPosition}`);

    // ランクを割り当て
    this.rankAssignmentService.assignRank(gameState, player);
  }

  /**
   * ラッキーセブン勝利処理
   */
  private handleLuckySevenVictory(gameState: GameState): void {
    if (!gameState.luckySeven) return;

    const luckyPlayer = gameState.players.find(p => p.id.value === gameState.luckySeven!.playerId);
    if (!luckyPlayer || luckyPlayer.isFinished) {
      gameState.luckySeven = null;
      return;
    }

    console.log(`${luckyPlayer.name} がラッキーセブンで勝利しました！`);
    const remainingCards = luckyPlayer.hand.getCards();
    if (remainingCards.length > 0) {
      luckyPlayer.hand.remove([...remainingCards]);
    }

    this.handlePlayerFinish(gameState, luckyPlayer);
    this.eventBus?.emit('luckySeven:victory', { playerName: luckyPlayer.name });
    gameState.luckySeven = null;
  }

  /**
   * フィールドと状態をリセット
   */
  private clearFieldAndResetState(gameState: GameState, resetElevenBack: boolean = true): void {
    gameState.field.clear();
    gameState.passCount = 0;
    gameState.isEightCutPending = false;
    gameState.suitLock = null;
    gameState.numberLock = false;

    if (resetElevenBack && gameState.isElevenBack) {
      gameState.isElevenBack = false;
      console.log('11バックがリセットされました');

      const shouldReverseStrength = this.getShouldReverseStrength(gameState);
      gameState.players.forEach(p => p.hand.sort(shouldReverseStrength));
    }

    console.log('場が流れました');
  }

  /**
   * 強さを反転すべきかを判定（革命XOR11バック）
   */
  private getShouldReverseStrength(gameState: GameState): boolean {
    return gameState.isRevolution !== gameState.isElevenBack;
  }

  private nextPlayer(gameState: GameState): void {
    // 次のプレイヤーを見つける（上がっていないプレイヤー）
    let attempts = 0;
    const maxAttempts = gameState.players.length;
    const direction = gameState.isReversed ? -1 : 1;

    do {
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
      attempts++;

      if (attempts > maxAttempts) {
        console.error('Could not find next active player');
        break;
      }
    } while (
      gameState.players[gameState.currentPlayerIndex].isFinished &&
      gameState.players.filter(p => !p.isFinished).length > 0
    );
  }

  /**
   * エフェクトを適用する
   * エフェクトの適用ロジックを一箇所に集約
   */
  private applyEffect(effect: TriggerEffect, gameState: GameState, player: Player): void {
    this.effectHandler.apply(effect, gameState, { player });
  }
}
