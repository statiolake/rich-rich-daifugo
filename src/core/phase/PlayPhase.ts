import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { Card } from '../domain/card/Card';
import { PlayAnalyzer } from '../domain/card/Play';
import { Player } from '../domain/player/Player';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { TriggerEffectAnalyzer, TriggerEffect } from '../rules/effects/TriggerEffectAnalyzer';
import { EffectHandler } from '../rules/effects/EffectHandler';
import { ConstraintChecker } from './handlers/ConstraintChecker';
import { GameEndChecker } from './handlers/GameEndChecker';
import { RankAssignmentService } from './handlers/RankAssignmentService';
import { PlayerController, Validator } from '../domain/player/PlayerController';
import { PresentationRequester, CutIn } from '../domain/presentation/PresentationRequester';

export class PlayPhase implements GamePhase {
  readonly type = GamePhaseType.PLAY;
  private effectAnalyzer: TriggerEffectAnalyzer;
  private effectHandler: EffectHandler;
  private constraintChecker: ConstraintChecker;
  private gameEndChecker: GameEndChecker;
  private rankAssignmentService: RankAssignmentService;

  constructor(
    private playerControllers: Map<string, PlayerController>,
    private ruleEngine: RuleEngine,
    private eventBus: GameEventEmitter,
    private presentationRequester: PresentationRequester
  ) {
    this.effectAnalyzer = new TriggerEffectAnalyzer();
    this.effectHandler = new EffectHandler(eventBus);
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

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.isFinished) {
      this.nextPlayer(gameState);
      return null;
    }

    const controller = this.playerControllers.get(currentPlayer.id.value);
    if (!controller) {
      throw new Error(`Player controller not found for ${currentPlayer.id.value}`);
    }

    // バリデーターを作成
    // RuleEngine.validate() は空配列でパス判定を行う
    const validator: Validator = {
      validate: (cards: Card[]) => {
        return this.ruleEngine.validate(currentPlayer, cards, gameState.field, gameState);
      }
    };

    // プレイヤーにカード選択を要求
    const selectedCards = await controller.chooseCardsInHand(validator);

    if (selectedCards.length === 0) {
      // パス
      await this.handlePass(gameState, currentPlayer);
    } else {
      // プレイ
      await this.handlePlay(gameState, currentPlayer, selectedCards);
    }

    return null;
  }

  async exit(_gameState: GameState): Promise<void> {
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
      throw new Error(`Invalid play: ${validation.reason}`);
    }

    const play = PlayAnalyzer.analyze(cards)!;

    // プレイを実行
    player.hand.remove(cards);
    gameState.field.addPlay(play, player.id);
    gameState.passCount = 0;

    console.log(`${player.name} played ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);

    // エフェクトを分析
    const effects = this.effectAnalyzer.analyze(play, gameState);

    // ラッキーセブンのリセット
    if (gameState.luckySeven && !effects.includes('ラッキーセブン')) {
      console.log('ラッキーセブンが破られました');
      gameState.luckySeven = null;
    }

    // マークしばりチェック
    this.constraintChecker.updateSuitLock(gameState, play);

    // 数字しばりチェック
    this.constraintChecker.updateNumberLock(gameState, play);

    // エフェクトを適用してカットインを収集
    const cutIns: CutIn[] = [];
    for (const effect of effects) {
      this.applyEffect(effect, gameState, player);

      // カットイン情報を収集
      const cutInData = this.getCutInData(effect);
      if (cutInData) {
        cutIns.push(cutInData);
      }
    }

    // カットインを表示（すべて完了まで待機）
    if (cutIns.length > 0) {
      await this.presentationRequester.requestCutIns(cutIns);
    }

    // ソート
    if (effects.length > 0) {
      gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
    }

    // 場のクリア判定
    let shouldClearField = false;
    if (gameState.isEightCutPending && !effects.includes('4止め')) {
      shouldClearField = true;
      console.log('8切りが発動します');
    }
    if (effects.includes('4止め')) {
      console.log('4止めが発動しました！');
      gameState.isEightCutPending = false;
    }
    if (effects.includes('救急車') || effects.includes('ろくろ首')) {
      shouldClearField = true;
    }

    if (shouldClearField) {
      this.handleLuckySevenVictory(gameState);
      this.clearFieldAndResetState(gameState);
    }

    const shouldKeepTurn = shouldClearField;

    // 大革命の即勝利処理
    if (effects.includes('大革命＋即勝利')) {
      const remainingCards = player.hand.getCards();
      if (remainingCards.length > 0) {
        player.hand.remove([...remainingCards]);
      }
      this.handlePlayerFinish(gameState, player);
      if (!shouldKeepTurn) {
        this.nextPlayer(gameState);
      }
      return;
    }

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }

    // 特殊ルール処理（await で待機）
    if (effects.includes('7渡し') && !player.hand.isEmpty()) {
      await this.handleSevenPass(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    if (effects.includes('10捨て') && !player.hand.isEmpty()) {
      await this.handleTenDiscard(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    if (effects.includes('クイーンボンバー')) {
      // 出されたQの枚数がターゲット数になる
      const queenCount = cards.filter(c => c.rank === 'Q').length;
      await this.handleQueenBomber(gameState, player, queenCount);
      this.nextPlayer(gameState);
      return;
    }

    // 5スキップ判定
    const shouldSkipNext = effects.includes('5スキップ');

    // 次プレイヤーへ
    if (!shouldKeepTurn) {
      this.nextPlayer(gameState);

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

  /**
   * エフェクトに応じたカットイン情報を取得
   */
  private getCutInData(effect: TriggerEffect): CutIn | null {
    const cutInMap: Partial<Record<TriggerEffect, CutIn>> = {
      '砂嵐': { effect: '砂嵐', variant: 'red' },
      '革命': { effect: '革命', variant: 'red' },
      '革命終了': { effect: '革命終了', variant: 'blue' },
      'イレブンバック': { effect: 'イレブンバック', variant: 'blue' },
      'イレブンバック解除': { effect: 'イレブンバック解除', variant: 'blue' },
      '4止め': { effect: '4止め', variant: 'blue' },
      '8切り': { effect: '8切り', variant: 'green' },
      '救急車': { effect: '救急車', variant: 'red' },
      'ろくろ首': { effect: 'ろくろ首', variant: 'red' },
      'エンペラー': { effect: 'エンペラー', variant: 'gold' },
      'エンペラー終了': { effect: 'エンペラー終了', variant: 'blue' },
      'クーデター': { effect: 'クーデター', variant: 'red' },
      'クーデター終了': { effect: 'クーデター終了', variant: 'blue' },
      'オーメン': { effect: 'オーメン', variant: 'yellow' },
      '大革命＋即勝利': { effect: '大革命＋即勝利', variant: 'gold' },
      '5スキップ': { effect: '5スキップ', variant: 'blue' },
      '7渡し': { effect: '7渡し', variant: 'blue' },
      '10捨て': { effect: '10捨て', variant: 'red' },
      'クイーンボンバー': { effect: 'クイーンボンバー', variant: 'red' },
      '9リバース': { effect: '9リバース', variant: 'blue' },
      'スペ3返し': { effect: 'スペ3返し', variant: 'green' },
      'ダウンナンバー': { effect: 'ダウンナンバー', variant: 'blue' },
      'ラッキーセブン': { effect: 'ラッキーセブン', variant: 'gold' },
    };

    return cutInMap[effect] || null;
  }

  /**
   * 7渡し処理（非同期）
   */
  private async handleSevenPass(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // バリデーター: 1枚だけ選択可能
    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length === 1) {
          return { valid: true };
        }
        return { valid: false, reason: '1枚選んでください' };
      }
    };

    const cards = await controller.chooseCardsInHand(validator, '7渡し：次のプレイヤーに渡すカードを1枚選んでください');
    if (cards.length !== 1) {
      throw new Error('Must select exactly 1 card for seven pass');
    }

    const card = cards[0];

    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    const nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let nextPlayer = gameState.players[nextIndex];

    let searchIndex = nextIndex;
    let attempts = 0;
    while (nextPlayer.isFinished && attempts < gameState.players.length) {
      searchIndex = (searchIndex + direction + gameState.players.length) % gameState.players.length;
      nextPlayer = gameState.players[searchIndex];
      attempts++;
    }

    if (!nextPlayer.isFinished) {
      player.hand.remove([card]);
      nextPlayer.hand.add([card]);
      console.log(`${player.name} が ${nextPlayer.name} に ${card.rank}${card.suit} を渡しました`);

      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      nextPlayer.hand.sort(shouldReverse);
    }

    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }
  }

  /**
   * 10捨て処理（非同期）
   */
  private async handleTenDiscard(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // バリデーター: 10より弱いカード1枚のみ
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    const tenStrength = shouldReverse ? 5 : 10;

    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length !== 1) {
          return { valid: false, reason: '1枚選んでください' };
        }
        const cardStrength = this.getCardStrength(cards[0].rank, shouldReverse);
        const isValid = shouldReverse ? cardStrength > tenStrength : cardStrength < tenStrength;
        if (!isValid) {
          return { valid: false, reason: '10より弱いカードを選んでください' };
        }
        return { valid: true };
      }
    };

    const cards = await controller.chooseCardsInHand(validator, '10捨て：10より弱いカードを1枚捨ててください');
    if (cards.length !== 1) {
      throw new Error('Must select exactly 1 card for ten discard');
    }

    const card = cards[0];
    player.hand.remove([card]);
    console.log(`${player.name} が ${card.rank}${card.suit} を捨てました`);

    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }
  }

  /**
   * クイーンボンバー処理（非同期）
   * @param targetCount 出されたQの枚数（＝捨てるべき枚数の上限）
   */
  private async handleQueenBomber(gameState: GameState, player: Player, targetCount: number): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // ランク選択
    const rank = await controller.chooseRankForQueenBomber();
    console.log(`クイーンボンバー：ランク ${rank} が指定されました（ターゲット数: ${targetCount}）`);

    // 全プレイヤーがカード選択
    for (const p of gameState.players) {
      if (p.isFinished) continue;

      const pController = this.playerControllers.get(p.id.value);
      if (!pController) continue;

      // プレイヤーの手札から指定ランクのカードを取得
      const rankCardsInHand = p.hand.getCards().filter(c => c.rank === rank);

      // 捨てるべき枚数 = min(手札にある指定ランクの枚数, ターゲット数)
      const requiredCount = Math.min(rankCardsInHand.length, targetCount);

      // バリデーター: 必要枚数を選択する必要がある（0枚の場合はパスのみ有効）
      const validator: Validator = {
        validate: (cards: Card[]) => {
          // 捨てるカードがない場合はパス（空配列）のみ有効
          if (requiredCount === 0) {
            if (cards.length === 0) {
              return { valid: true };
            }
            return { valid: false, reason: '選択できるカードがありません' };
          }
          // 必要枚数を選択していること
          if (cards.length !== requiredCount) {
            return { valid: false, reason: `${rank}を${requiredCount}枚選んでください` };
          }
          // すべてのカードが指定ランクであること
          if (!cards.every(c => c.rank === rank)) {
            return { valid: false, reason: `${rank}のカードのみ選択できます` };
          }
          return { valid: true };
        }
      };

      const prompt = requiredCount === 0
        ? `クイーンボンバー：${rank}を持っていません（パス）`
        : `クイーンボンバー：${rank}を${requiredCount}枚捨ててください`;

      const cards = await pController.chooseCardsInHand(validator, prompt);

      if (cards.length > 0) {
        p.hand.remove(cards);
        console.log(`${p.name} が ${cards.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

        if (p.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, p);
        }
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
