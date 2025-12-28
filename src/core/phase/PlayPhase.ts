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

  async enter(gameState: GameState): Promise<void> {
    this.clearFieldAndResetState(gameState, true);
    gameState.isReversed = false; // リバースをリセット

    // 初回ラウンドはランダムなプレイヤーから開始
    // 2回目以降は大富豪から開始（まだ実装していないので常にランダム）
    gameState.currentPlayerIndex = Math.floor(Math.random() * gameState.players.length);

    console.log(`Play phase started. Starting player: ${gameState.players[gameState.currentPlayerIndex].name}`);
  }

  /**
   * @deprecated ステップ実行モードでは使用しない。executePlay/executePassを使用。
   */
  async update(gameState: GameState): Promise<GamePhaseType | null> {
    throw new Error('update() is deprecated in step-execution mode. Use GameEngine.executePlay() or executePass() instead.');
  }

  async exit(gameState: GameState): Promise<void> {
    console.log('Play phase ended');
  }

  /**
   * プレイを処理（同期的）
   * カットイン待機は削除され、エフェクトはイベント発火のみ行う
   */
  handlePlaySync(
    gameState: GameState,
    player: Player,
    cards: Card[]
  ): void {
    // 検証
    const validation = this.ruleEngine.validate(player, cards, gameState.field, gameState);
    if (!validation.valid) {
      throw new Error(`Invalid play: ${validation.reason}`);
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

    // カットイン待機は削除（UIが自動的にアニメーション再生）

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

    // 特殊ルール（7渡し、10捨て、クイーンボンバー）は gameState にフラグを立てる
    // UIが検出して、別のフローで処理する
    if (effects.includes('7渡し') && !player.hand.isEmpty()) {
      gameState.pendingSpecialRule = {
        type: 'sevenPass',
        playerId: player.id.value
      };
      // nextPlayer() を呼ばずに、UIが7渡し処理を行うまで待機
      return;
    }

    if (effects.includes('10捨て') && !player.hand.isEmpty()) {
      gameState.pendingSpecialRule = {
        type: 'tenDiscard',
        playerId: player.id.value
      };
      return;
    }

    if (effects.includes('クイーンボンバー')) {
      gameState.pendingSpecialRule = {
        type: 'queenBomber',
        playerId: player.id.value
      };
      return;
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

  /**
   * パスを処理（同期的）
   */
  handlePassSync(gameState: GameState, player: Player): void {
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

  /**
   * 7渡し実行（同期的）
   */
  executeSevenPassSync(gameState: GameState, player: Player, card: Card): void {
    // カードの所有権チェック
    if (!player.hand.getCards().some(c => c.id === card.id)) {
      throw new Error('Card not in hand');
    }

    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    const nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let nextPlayer = gameState.players[nextIndex];

    // 上がっていないプレイヤーを探す
    let searchIndex = nextIndex;
    let attempts = 0;
    while (nextPlayer.isFinished && attempts < gameState.players.length) {
      searchIndex = (searchIndex + direction + gameState.players.length) % gameState.players.length;
      nextPlayer = gameState.players[searchIndex];
      attempts++;
    }

    if (!nextPlayer.isFinished) {
      // カードを渡す
      player.hand.remove([card]);
      nextPlayer.hand.add([card]);

      console.log(`${player.name} が ${nextPlayer.name} に ${card.rank}${card.suit} を渡しました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      nextPlayer.hand.sort(shouldReverse);
    }

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }

    // 次のプレイヤーに進む
    this.nextPlayer(gameState);
  }

  /**
   * 10捨て実行（同期的）
   */
  executeTenDiscardSync(gameState: GameState, player: Player, card: Card): void {
    // カードの所有権チェック
    if (!player.hand.getCards().some(c => c.id === card.id)) {
      throw new Error('Card not in hand');
    }

    // 10より弱いカードかチェック（革命・11バックを考慮）
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    const tenStrength = shouldReverse ? 5 : 10; // 10のランク強さ（通常は10、革命時は5）
    const cardStrength = this.getCardStrength(card.rank, shouldReverse);

    // 10より弱いか確認（shouldReverse時は強さが逆転）
    const isWeakerThanTen = shouldReverse
      ? cardStrength > tenStrength
      : cardStrength < tenStrength;

    if (!isWeakerThanTen) {
      throw new Error('Card is not weaker than 10');
    }

    // カードを捨てる
    player.hand.remove([card]);

    console.log(`${player.name} が ${card.rank}${card.suit} を捨てました`);

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }

    // 次のプレイヤーに進む
    this.nextPlayer(gameState);
  }

  /**
   * クイーンボンバー実行（同期的）
   */
  executeQueenBomberSync(gameState: GameState, player: Player, rank?: string, cards?: Card[]): void {
    // ランク選択フェーズ
    if (rank && !cards) {
      // contextにランクを保存
      if (!gameState.pendingSpecialRule) {
        throw new Error('No pending special rule');
      }
      gameState.pendingSpecialRule.context = { selectedRank: rank };
      console.log(`クイーンボンバー：ランク ${rank} が指定されました`);
      return;
    }

    // カード捨てフェーズ
    if (cards && gameState.pendingSpecialRule?.context?.selectedRank) {
      const selectedRank = gameState.pendingSpecialRule.context.selectedRank;

      // 全カードが指定ランクか確認
      const allMatchRank = cards.every(c => c.rank === selectedRank);
      if (!allMatchRank) {
        throw new Error(`All cards must be rank ${selectedRank}`);
      }

      // カードの所有権チェック
      const playerCards = player.hand.getCards();
      const allOwned = cards.every(c => playerCards.some(pc => pc.id === c.id));
      if (!allOwned) {
        throw new Error('Not all cards are in hand');
      }

      // カードを捨てる
      player.hand.remove(cards);
      console.log(`${player.name} が ${cards.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

      // 手札が空になったら上がり
      if (player.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, player);
      }
    }
  }

  /**
   * カードの強さを取得（ヘルパーメソッド）
   */
  private getCardStrength(rank: string, shouldReverse: boolean): number {
    const normalStrength: { [key: string]: number } = {
      '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
    };

    const strength = normalStrength[rank] || 0;

    if (shouldReverse) {
      // 革命時は強さを反転（3が最強、2が最弱）
      return 18 - strength;
    }

    return strength;
  }
}
