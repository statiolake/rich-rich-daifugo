import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { Card, Suit } from '../domain/card/Card';
import { PlayAnalyzer, Play } from '../domain/card/Play';
import { Player } from '../domain/player/Player';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';
import { TriggerEffectAnalyzer, TriggerEffect } from '../rules/effects/TriggerEffectAnalyzer';
import { EffectHandler } from '../rules/effects/EffectHandler';
import { GameEndChecker } from './handlers/GameEndChecker';
import { RankAssignmentService } from './handlers/RankAssignmentService';
import { PlayerController, Validator } from '../domain/player/PlayerController';
import { PresentationRequester, CutIn } from '../domain/presentation/PresentationRequester';

export class PlayPhase implements GamePhase {
  readonly type = GamePhaseType.PLAY;
  private effectAnalyzer: TriggerEffectAnalyzer;
  private effectHandler: EffectHandler;
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
    this.gameEndChecker = new GameEndChecker(ruleEngine);
    this.rankAssignmentService = new RankAssignmentService();
  }

  async enter(gameState: GameState): Promise<void> {
    await this.clearFieldAndResetState(gameState, true);
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

    // エフェクトを分析（field.addPlay() の前に行う - プレビューと同じタイミング）
    const effects = this.effectAnalyzer.analyze(play, gameState);

    // プレイを実行
    player.hand.remove(cards);
    gameState.field.addPlay(play, player.id);
    gameState.passCount = 0;

    console.log(`${player.name} played ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);

    // ラッキーセブンのリセット
    if (gameState.luckySeven && !effects.includes('ラッキーセブン')) {
      console.log('ラッキーセブンが破られました');
      gameState.luckySeven = null;
    }

    // エフェクトを適用してカットインを収集
    const cutIns: CutIn[] = [];
    for (const effect of effects) {
      this.applyEffect(effect, gameState, player, play);

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
    let salvagePlayer: Player | undefined = undefined;
    let nextAcePlayer: Player | undefined = undefined;

    if (gameState.isEightCutPending && !effects.includes('4止め')) {
      shouldClearField = true;
      console.log('8切りが発動します');
      // 8切りで場が流れる場合、3を含むカードを出したプレイヤーにサルベージ権利
      if (cards.some(c => c.rank === '3')) {
        salvagePlayer = player;
      }
      // 8切りで場が流れる場合、Aを含むカードを出したプレイヤーに次期エース権利
      if (cards.some(c => c.rank === 'A')) {
        nextAcePlayer = player;
      }
    }
    if (effects.includes('4止め')) {
      console.log('4止めが発動しました！');
      gameState.isEightCutPending = false;
    }
    if (effects.includes('救急車') || effects.includes('ろくろ首')) {
      shouldClearField = true;
      // 救急車・ろくろ首で場が流れる場合はサルベージなし（3が含まれない）
      // 救急車(9x2)で場が流れる場合も次期エースなし（Aが含まれない）
    }
    // 暗殺で場が流れる（2に対して3、革命中は逆）
    if (effects.includes('暗殺')) {
      shouldClearField = true;
      console.log('暗殺が発動します');
      if (cards.some(c => c.rank === '3')) {
        salvagePlayer = player;
      }
    }
    // 33返しで場が流れる（ジョーカー1枚に対して3x3）
    if (effects.includes('33返し')) {
      shouldClearField = true;
      console.log('33返しが発動します');
      salvagePlayer = player;
    }
    // スペ2返しで場が流れる（革命中ジョーカーに対してスペード2）
    if (effects.includes('スペ2返し')) {
      shouldClearField = true;
      console.log('スペ2返しが発動します');
    }
    // 5切り/6切り/7切り（革命中に場が流れる）
    if (effects.includes('5切り') || effects.includes('6切り') || effects.includes('7切り')) {
      shouldClearField = true;
      console.log('革命中の切りが発動します');
    }

    if (shouldClearField) {
      this.handleLuckySevenVictory(gameState);
      await this.clearFieldAndResetState(gameState, true, salvagePlayer, nextAcePlayer);
    }

    // 9クイック: 9を出すと続けてもう1回出せる（ターンを維持）
    const shouldKeepTurnForNineQuick = effects.includes('9クイック');
    const shouldKeepTurn = shouldClearField || shouldKeepTurnForNineQuick;

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

    // 特殊ルール処理（await で待機）
    // 注意: 手札が空になる前に処理する必要があるルール（Qボンバー）と、
    //       手札が空でない場合のみ処理するルール（7渡し、10捨て）がある

    // Qボンバーは手札が空になる前に処理（上がり判定の前）
    // 他のプレイヤーがカードを捨てる処理なので、自分が上がっても実行する
    if (effects.includes('クイーンボンバー')) {
      // 出されたQの枚数がターゲット数になる
      const queenCount = cards.filter(c => c.rank === 'Q').length;
      await this.handleQueenBomber(gameState, player, queenCount);
    }

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 以下は手札が残っている場合のみ処理

    // キングの行進（Kを出すと枚数分捨て札から回収）
    if (effects.includes('キングの行進')) {
      const kingCount = cards.filter(c => c.rank === 'K').length;
      await this.handleKingsMarch(gameState, player, kingCount);
    }

    // ゾンビ（3x3で捨て札から任意カードを次のプレイヤーに渡す）
    if (effects.includes('ゾンビ')) {
      await this.handleZombie(gameState, player);
    }

    // サタン（6x3で捨て札から任意カード1枚を回収）
    if (effects.includes('サタン')) {
      await this.handleSatan(gameState, player);
    }

    // 栗拾い（9を出すと枚数分だけ捨て札から回収）
    if (effects.includes('栗拾い')) {
      const nineCount = cards.filter(c => c.rank === '9').length;
      await this.handleChestnutPicking(gameState, player, nineCount);
    }

    // 銀河鉄道999（9x3で手札2枚を捨て、捨て札から2枚引く）
    if (effects.includes('銀河鉄道999')) {
      await this.handleGalaxyExpress999(gameState, player);
    }

    // 黒7（スペード7またはクラブ7を出すと、枚数分だけ捨て山からランダムにカードを引く）
    if (effects.includes('黒7')) {
      const blackSevenCount = cards.filter(
        c => c.rank === '7' && (c.suit === Suit.SPADE || c.suit === Suit.CLUB)
      ).length;
      await this.handleBlackSeven(gameState, player, blackSevenCount);
    }

    if (effects.includes('7渡し')) {
      await this.handleSevenPass(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 9戻し（9を出すと枚数分のカードを直前のプレイヤーに渡す）
    if (effects.includes('9戻し')) {
      const nineCount = cards.filter(c => c.rank === '9').length;
      await this.handleNineReturn(gameState, player, nineCount);
      this.nextPlayer(gameState);
      return;
    }

    if (effects.includes('10捨て')) {
      await this.handleTenDiscard(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 7付け（7を出すと枚数分のカードを追加で捨てる）
    if (effects.includes('7付け')) {
      const sevenCount = cards.filter(c => c.rank === '7').length;
      await this.handleSevenAttach(gameState, player, sevenCount);
      this.nextPlayer(gameState);
      return;
    }

    // 5スキップ・フリーメイソン・10飛び判定
    const shouldSkipNext = effects.includes('5スキップ') || effects.includes('フリーメイソン') || effects.includes('10飛び');

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

    // ダミアン発動中はパスしたプレイヤーが敗北
    if (gameState.isDamianActive) {
      console.log(`ダミアン発動中！${player.name} はパスしたため敗北`);
      this.handlePlayerDefeat(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

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

      // 最後に出されたカードに応じて権利を付与
      let salvagePlayer: Player | undefined = undefined;
      let nextAcePlayer: Player | undefined = undefined;
      const lastPlay = gameState.field.getLastPlay();
      if (lastPlay) {
        const lastPlayer = gameState.players.find(p => p.id.value === lastPlay.playerId.value);
        // 3を含む場合、サルベージ権利
        if (lastPlay.play.cards.some(c => c.rank === '3')) {
          salvagePlayer = lastPlayer;
        }
        // Aを含む場合、次期エース権利
        if (lastPlay.play.cards.some(c => c.rank === 'A')) {
          nextAcePlayer = lastPlayer;
        }
      }

      this.handleLuckySevenVictory(gameState);
      await this.clearFieldAndResetState(gameState, true, salvagePlayer, nextAcePlayer);
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
   * ダミアンによる敗北処理
   * パスしたプレイヤーを最下位で敗北させる
   */
  private handlePlayerDefeat(gameState: GameState, player: Player): void {
    // 残っているアクティブプレイヤーの最後の順位を割り当て
    const lastPosition = gameState.players.length;
    player.isFinished = true;
    player.finishPosition = lastPosition;

    console.log(`${player.name} はダミアンにより敗北（順位: ${player.finishPosition}）`);

    // ランクを割り当て（大貧民として）
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
   * @param salvagePlayer サルベージ権利を持つプレイヤー（3で場が流れた場合）
   * @param nextAcePlayer 次期エース権利を持つプレイヤー（Aで場が流れた場合）
   */
  private async clearFieldAndResetState(
    gameState: GameState,
    resetElevenBack: boolean = true,
    salvagePlayer?: Player,
    nextAcePlayer?: Player
  ): Promise<void> {
    // 場のカードを捨て札に移動
    const history = gameState.field.getHistory();
    for (const playHistory of history) {
      gameState.discardPile.push(...playHistory.play.cards);
    }

    gameState.field.clear();
    gameState.passCount = 0;
    gameState.isEightCutPending = false;
    gameState.suitLock = null;
    gameState.numberLock = false;
    gameState.colorLock = null;
    gameState.isTwoBack = false; // 2バックをリセット
    gameState.isDamianActive = false; // ダミアンをリセット

    if (resetElevenBack && gameState.isElevenBack) {
      // 強化Jバック中の場合はelevenBackDurationをデクリメント
      if (gameState.elevenBackDuration > 0) {
        gameState.elevenBackDuration--;
        console.log(`強化Jバック: 残り${gameState.elevenBackDuration}回`);
        // まだ持続回数が残っている場合はリセットしない
        if (gameState.elevenBackDuration > 0) {
          console.log('11バックは強化Jバックにより持続中');
        } else {
          gameState.isElevenBack = false;
          console.log('強化Jバックが終了しました');
          const shouldReverseStrength = this.getShouldReverseStrength(gameState);
          gameState.players.forEach(p => p.hand.sort(shouldReverseStrength));
        }
      } else {
        gameState.isElevenBack = false;
        console.log('11バックがリセットされました');
        const shouldReverseStrength = this.getShouldReverseStrength(gameState);
        gameState.players.forEach(p => p.hand.sort(shouldReverseStrength));
      }
    }

    console.log('場が流れました');

    // 次期エース処理（Aで場が流れた時に親になる）
    if (nextAcePlayer && gameState.ruleSettings.nextAce && !nextAcePlayer.isFinished) {
      const nextAceIndex = gameState.players.findIndex(p => p.id.value === nextAcePlayer.id.value);
      if (nextAceIndex !== -1) {
        gameState.currentPlayerIndex = nextAceIndex;
        console.log(`次期エース：${nextAcePlayer.name} が親になりました`);
        await this.presentationRequester.requestCutIns([{ effect: '次期エース', variant: 'gold' }]);
      }
    }

    // サルベージ処理（3で場が流れた時に捨て札から1枚回収）
    if (salvagePlayer && gameState.ruleSettings.salvage && gameState.discardPile.length > 0) {
      await this.handleSalvage(gameState, salvagePlayer);
    }
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
  private applyEffect(effect: TriggerEffect, gameState: GameState, player: Player, play?: Play): void {
    // マークしばりの場合、プレイのスートをコンテキストに含める
    const suit = play && play.cards.length > 0 ? play.cards[0].suit : undefined;
    this.effectHandler.apply(effect, gameState, { player, suit });
  }

  /**
   * エフェクトに応じたカットイン情報を取得
   */
  private getCutInData(effect: TriggerEffect): CutIn | null {
    const cutInMap: Partial<Record<TriggerEffect, CutIn>> = {
      '砂嵐': { effect: '砂嵐', variant: 'red' },
      '33返し': { effect: '33返し', variant: 'gold' },
      '暗殺': { effect: '暗殺', variant: 'red' },
      '革命': { effect: '革命', variant: 'red' },
      '革命終了': { effect: '革命終了', variant: 'blue' },
      '階段革命': { effect: '階段革命', variant: 'red' },
      '階段革命終了': { effect: '階段革命終了', variant: 'blue' },
      'イレブンバック': { effect: 'イレブンバック', variant: 'blue' },
      'イレブンバック解除': { effect: 'イレブンバック解除', variant: 'blue' },
      '4止め': { effect: '4止め', variant: 'blue' },
      '8切り': { effect: '8切り', variant: 'green' },
      '5切り': { effect: '5切り', variant: 'green' },
      '6切り': { effect: '6切り', variant: 'green' },
      '7切り': { effect: '7切り', variant: 'green' },
      '救急車': { effect: '救急車', variant: 'red' },
      'ろくろ首': { effect: 'ろくろ首', variant: 'red' },
      'エンペラー': { effect: 'エンペラー', variant: 'gold' },
      'エンペラー終了': { effect: 'エンペラー終了', variant: 'blue' },
      'クーデター': { effect: 'クーデター', variant: 'red' },
      'クーデター終了': { effect: 'クーデター終了', variant: 'blue' },
      'オーメン': { effect: 'オーメン', variant: 'yellow' },
      '大革命＋即勝利': { effect: '大革命＋即勝利', variant: 'gold' },
      'ジョーカー革命': { effect: 'ジョーカー革命', variant: 'gold' },
      'ジョーカー革命終了': { effect: 'ジョーカー革命終了', variant: 'blue' },
      '5スキップ': { effect: '5スキップ', variant: 'blue' },
      'フリーメイソン': { effect: 'フリーメイソン', variant: 'green' },
      '10飛び': { effect: '10飛び', variant: 'green' },
      '7渡し': { effect: '7渡し', variant: 'blue' },
      '7付け': { effect: '7付け', variant: 'blue' },
      '10捨て': { effect: '10捨て', variant: 'red' },
      'クイーンボンバー': { effect: 'クイーンボンバー', variant: 'red' },
      '9リバース': { effect: '9リバース', variant: 'blue' },
      'Qリバース': { effect: 'Qリバース', variant: 'blue' },
      'Kリバース': { effect: 'Kリバース', variant: 'blue' },
      'スペ3返し': { effect: 'スペ3返し', variant: 'green' },
      'スペ2返し': { effect: 'スペ2返し', variant: 'green' },
      'ダウンナンバー': { effect: 'ダウンナンバー', variant: 'blue' },
      'ラッキーセブン': { effect: 'ラッキーセブン', variant: 'gold' },
      'マークしばり': { effect: 'マークしばり', variant: 'blue' },
      '数字しばり': { effect: '数字しばり', variant: 'blue' },
      'キングの行進': { effect: 'キングの行進', variant: 'gold' },
      'ナナサン革命': { effect: 'ナナサン革命', variant: 'red' },
      'ナナサン革命終了': { effect: 'ナナサン革命終了', variant: 'blue' },
      '2バック': { effect: '2バック', variant: 'blue' },
      'ゾンビ': { effect: 'ゾンビ', variant: 'green' },
      'サタン': { effect: 'サタン', variant: 'red' },
      '栗拾い': { effect: '栗拾い', variant: 'green' },
      '銀河鉄道999': { effect: '銀河鉄道999', variant: 'gold' },
      '黒7': { effect: '黒7', variant: 'blue' },
      '9クイック': { effect: '9クイック', variant: 'green' },
      '9戻し': { effect: '9戻し', variant: 'blue' },
      '強化Jバック': { effect: '強化Jバック', variant: 'gold' },
      'ダミアン': { effect: 'ダミアン', variant: 'red' },
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
   * 7付け処理（非同期）
   * 7を出すと、出した7の枚数分のカードを手札から追加で捨てる
   * @param sevenCount 出された7の枚数（＝捨てる枚数）
   */
  private async handleSevenAttach(gameState: GameState, player: Player, sevenCount: number): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 手札が足りない場合は持っている枚数まで
    const handCards = player.hand.getCards();
    const maxDiscard = Math.min(sevenCount, handCards.length);

    // 捨てられるカードがない場合はスキップ
    if (maxDiscard === 0) {
      console.log(`${player.name} は手札がないためスキップ`);
      return;
    }

    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length !== maxDiscard) {
          return { valid: false, reason: `${maxDiscard}枚選んでください` };
        }
        return { valid: true };
      }
    };

    const cards = await controller.chooseCardsInHand(validator, `7付け：${maxDiscard}枚捨ててください`);
    if (cards.length !== maxDiscard) {
      throw new Error(`Must select exactly ${maxDiscard} cards for seven attach`);
    }

    player.hand.remove(cards);
    gameState.discardPile.push(...cards);
    console.log(`${player.name} が ${cards.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました（7付け）`);

    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }
  }

  /**
   * 9戻し処理（非同期）
   * 9を出すと、出した9の枚数分のカードを直前のプレイヤーに渡す
   * @param nineCount 出された9の枚数（＝渡す枚数）
   */
  private async handleNineReturn(gameState: GameState, player: Player, nineCount: number): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 直前のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    const prevDirection = -direction;
    const prevIndex = (gameState.currentPlayerIndex + prevDirection + gameState.players.length) % gameState.players.length;
    let prevPlayer = gameState.players[prevIndex];

    let searchIndex = prevIndex;
    let attempts = 0;
    while (prevPlayer.isFinished && attempts < gameState.players.length) {
      searchIndex = (searchIndex + prevDirection + gameState.players.length) % gameState.players.length;
      prevPlayer = gameState.players[searchIndex];
      attempts++;
    }

    if (prevPlayer.isFinished) {
      console.log('直前のプレイヤーがいないため9戻しをスキップ');
      return;
    }

    // 手札が足りない場合は持っている枚数まで
    const handCards = player.hand.getCards();
    const maxPass = Math.min(nineCount, handCards.length);

    if (maxPass === 0) {
      console.log(`${player.name} は手札がないためスキップ`);
      return;
    }

    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length === maxPass) {
          return { valid: true };
        }
        return { valid: false, reason: `${maxPass}枚選んでください` };
      }
    };

    const cards = await controller.chooseCardsInHand(validator, `9戻し：${prevPlayer.name}に渡すカードを${maxPass}枚選んでください`);
    if (cards.length !== maxPass) {
      throw new Error(`Must select exactly ${maxPass} cards for nine return`);
    }

    player.hand.remove(cards);
    prevPlayer.hand.add(cards);
    console.log(`${player.name} が ${prevPlayer.name} に ${cards.map(c => `${c.rank}${c.suit}`).join(', ')} を渡しました（9戻し）`);

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    prevPlayer.hand.sort(shouldReverse);

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

    // 10より弱いカードがあるかチェック
    const handCards = player.hand.getCards();
    const discardableCards = handCards.filter(c => {
      const cardStrength = this.getCardStrength(c.rank, shouldReverse);
      return shouldReverse ? cardStrength > tenStrength : cardStrength < tenStrength;
    });

    // 捨てられるカードがない場合はスキップ
    if (discardableCards.length === 0) {
      console.log(`${player.name} は10より弱いカードを持っていないためスキップ`);
      return;
    }

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
   * Q1枚ごとに1つのランクを選択し、全員がそのランクのカードをすべて捨てる
   * @param queenCount 出されたQの枚数（＝選択できるランクの数）
   */
  private async handleQueenBomber(gameState: GameState, player: Player, queenCount: number): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // Q1枚ごとにランクを選択
    const selectedRanks: string[] = [];
    for (let i = 0; i < queenCount; i++) {
      const rank = await controller.chooseRankForQueenBomber();
      selectedRanks.push(rank);
      console.log(`クイーンボンバー：ランク ${rank} が指定されました（${i + 1}/${queenCount}）`);
    }

    console.log(`クイーンボンバー：ランク [${selectedRanks.join(', ')}] がターゲット`);

    // 全プレイヤーが対象ランクのカードをすべて捨てる（自動処理）
    for (const p of gameState.players) {
      if (p.isFinished) continue;

      // プレイヤーの手札から対象ランクのカードをすべて取得
      const cardsToDiscard = p.hand.getCards().filter(c => selectedRanks.includes(c.rank));

      if (cardsToDiscard.length > 0) {
        p.hand.remove(cardsToDiscard);
        console.log(`${p.name} が ${cardsToDiscard.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

        if (p.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, p);
        }
      }
    }
  }

  /**
   * サルベージ処理（非同期）
   * 3で場が流れた時に捨て札から1枚回収
   */
  private async handleSalvage(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないためサルベージをスキップ');
      return;
    }

    // カットインを表示
    await this.presentationRequester.requestCutIns([{ effect: 'サルベージ', variant: 'green' }]);

    console.log('サルベージ：1枚まで回収可能');

    // カード選択（最大1枚）
    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      1,
      'サルベージ：捨て札から1枚選んでください'
    );

    if (selectedCards.length > 0) {
      const card = selectedCards[0];
      // 捨て札から削除
      const index = gameState.discardPile.findIndex(
        (c: Card) => c.suit === card.suit && c.rank === card.rank
      );
      if (index !== -1) {
        gameState.discardPile.splice(index, 1);
      }

      // 手札に追加
      player.hand.add([card]);
      console.log(`${player.name} が ${card.rank}${card.suit} を回収しました（サルベージ）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
    }
  }

  /**
   * キングの行進処理（非同期）
   * Kを出すと枚数分だけ捨て札から好きなカードを回収
   * @param kingCount 出されたKの枚数（＝回収できる枚数の上限）
   */
  private async handleKingsMarch(gameState: GameState, player: Player, kingCount: number): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないためキングの行進をスキップ');
      return;
    }

    // 回収できる枚数 = min(捨て札の枚数, Kの枚数)
    const maxRecovery = Math.min(gameState.discardPile.length, kingCount);

    console.log(`キングの行進：${maxRecovery}枚まで回収可能`);

    // カード選択
    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      maxRecovery,
      `キングの行進：捨て札から${maxRecovery}枚まで選んでください`
    );

    if (selectedCards.length > 0) {
      // 捨て札から削除
      for (const card of selectedCards) {
        const index = gameState.discardPile.findIndex(
          (c: Card) => c.suit === card.suit && c.rank === card.rank
        );
        if (index !== -1) {
          gameState.discardPile.splice(index, 1);
        }
      }

      // 手札に追加
      player.hand.add(selectedCards);
      console.log(`${player.name} が ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')} を回収しました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
    }
  }

  /**
   * ゾンビ処理（非同期）
   * 3x3で捨て札から任意カードを選び、次のプレイヤーに渡す
   */
  private async handleZombie(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないためゾンビをスキップ');
      return;
    }

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

    if (nextPlayer.isFinished) {
      console.log('次のプレイヤーがいないためゾンビをスキップ');
      return;
    }

    console.log(`ゾンビ：${nextPlayer.name} にカードを渡します`);

    // カード選択（1枚）
    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      1,
      `ゾンビ：捨て札から1枚選んで${nextPlayer.name}に渡してください`
    );

    if (selectedCards.length > 0) {
      const card = selectedCards[0];
      // 捨て札から削除
      const index = gameState.discardPile.findIndex(
        (c: Card) => c.suit === card.suit && c.rank === card.rank
      );
      if (index !== -1) {
        gameState.discardPile.splice(index, 1);
      }

      // 次のプレイヤーの手札に追加
      nextPlayer.hand.add([card]);
      console.log(`${player.name} が ${card.rank}${card.suit} を ${nextPlayer.name} に渡しました（ゾンビ）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      nextPlayer.hand.sort(shouldReverse);
    }
  }

  /**
   * サタン処理（非同期）
   * 6x3で捨て札から任意カード1枚を回収
   */
  private async handleSatan(gameState: GameState, player: Player): Promise<void> {
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないためサタンをスキップ');
      return;
    }

    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('コントローラーがないためサタンをスキップ');
      return;
    }

    console.log(`サタン：${player.name} が捨て札から1枚回収します`);

    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      1,
      'サタン：捨て札から1枚選んで回収してください'
    );

    if (selectedCards.length > 0) {
      const card = selectedCards[0];
      // 捨て札から削除
      const index = gameState.discardPile.findIndex(
        (c: Card) => c.suit === card.suit && c.rank === card.rank
      );
      if (index !== -1) {
        gameState.discardPile.splice(index, 1);
      }

      // プレイヤーの手札に追加
      player.hand.add([card]);
      console.log(`${player.name} が ${card.rank}${card.suit} を回収しました（サタン）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
    }
  }

  /**
   * 栗拾い処理（非同期）
   * 9を出すと枚数分だけ捨て札から回収
   */
  private async handleChestnutPicking(gameState: GameState, player: Player, count: number): Promise<void> {
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないため栗拾いをスキップ');
      return;
    }

    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('コントローラーがないため栗拾いをスキップ');
      return;
    }

    const maxCount = Math.min(count, gameState.discardPile.length);
    console.log(`栗拾い：${player.name} が捨て札から${maxCount}枚回収します`);

    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      maxCount,
      `栗拾い：捨て札から${maxCount}枚まで選んで回収してください`
    );

    if (selectedCards.length > 0) {
      for (const card of selectedCards) {
        // 捨て札から削除
        const index = gameState.discardPile.findIndex(
          (c: Card) => c.suit === card.suit && c.rank === card.rank
        );
        if (index !== -1) {
          gameState.discardPile.splice(index, 1);
        }
      }

      // プレイヤーの手札に追加
      player.hand.add(selectedCards);
      console.log(`${player.name} が ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')} を回収しました（栗拾い）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
    }
  }

  /**
   * 銀河鉄道999処理（非同期）
   * 9x3で手札2枚を捨て、捨て札から2枚引く
   */
  private async handleGalaxyExpress999(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('コントローラーがないため銀河鉄道999をスキップ');
      return;
    }

    // 手札から2枚捨てる（手札が2枚未満の場合はスキップ）
    const handCards = player.hand.getCards();
    if (handCards.length < 2) {
      console.log('手札が2枚未満のため銀河鉄道999をスキップ');
      return;
    }

    console.log(`銀河鉄道999：${player.name} が手札から2枚捨てて、捨て札から2枚引きます`);

    // 捨てるカードを選択
    const discardValidator = {
      validate: (cards: Card[]) => ({ valid: cards.length === 2, reason: cards.length !== 2 ? '2枚選んでください' : undefined })
    };

    const cardsToDiscard = await controller.chooseCardsInHand(
      discardValidator,
      '銀河鉄道999：捨てる2枚を選んでください'
    );

    if (cardsToDiscard.length === 2) {
      // 手札から削除して捨て札に追加
      player.hand.remove(cardsToDiscard);
      gameState.discardPile.push(...cardsToDiscard);
      console.log(`${player.name} が ${cardsToDiscard.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);
    }

    // 捨て札から2枚引く
    if (gameState.discardPile.length >= 2) {
      const cardsToDraw = await controller.chooseCardsFromDiscard(
        gameState.discardPile,
        2,
        '銀河鉄道999：捨て札から2枚選んで引いてください'
      );

      if (cardsToDraw.length > 0) {
        for (const card of cardsToDraw) {
          const index = gameState.discardPile.findIndex(
            (c: Card) => c.suit === card.suit && c.rank === card.rank
          );
          if (index !== -1) {
            gameState.discardPile.splice(index, 1);
          }
        }

        player.hand.add(cardsToDraw);
        console.log(`${player.name} が ${cardsToDraw.map(c => `${c.rank}${c.suit}`).join(', ')} を引きました`);

        // ソート
        const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
        player.hand.sort(shouldReverse);
      }
    } else {
      console.log('捨て札が2枚未満のため、引くことができません');
    }
  }

  /**
   * 黒7処理（非同期）
   * スペード7またはクラブ7を出すと、枚数分だけ捨て山からランダムにカードを引く
   * @param blackSevenCount 出された黒7の枚数（＝引く枚数）
   */
  private async handleBlackSeven(gameState: GameState, player: Player, blackSevenCount: number): Promise<void> {
    if (gameState.discardPile.length === 0) {
      console.log('捨て札がないため黒7をスキップ');
      return;
    }

    // 引ける枚数 = min(捨て札の枚数, 黒7の枚数)
    const drawCount = Math.min(gameState.discardPile.length, blackSevenCount);

    console.log(`黒7：${player.name} が捨て札から${drawCount}枚ランダムに引きます`);

    // 捨て札からランダムに選択
    const drawnCards: Card[] = [];
    for (let i = 0; i < drawCount; i++) {
      if (gameState.discardPile.length === 0) break;

      // ランダムなインデックスを選択
      const randomIndex = Math.floor(Math.random() * gameState.discardPile.length);
      const card = gameState.discardPile.splice(randomIndex, 1)[0];
      drawnCards.push(card);
    }

    if (drawnCards.length > 0) {
      // プレイヤーの手札に追加
      player.hand.add(drawnCards);
      console.log(`${player.name} が ${drawnCards.map(c => `${c.rank}${c.suit}`).join(', ')} を引きました（黒7）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
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
