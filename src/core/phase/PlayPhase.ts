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
import { PlayerRank } from '../domain/player/PlayerRank';

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
    gameState.isFirstTurn = true; // 最初のターンフラグをセット
    gameState.hasDaifugoPassedFirst = false; // 大富豪の余裕フラグをリセット

    // ダイヤ3スタートの場合はSetupPhaseで設定済み
    // それ以外は初回ランダム、2回目以降は大富豪から
    if (!gameState.ruleSettings.diamond3Start) {
      gameState.currentPlayerIndex = Math.floor(Math.random() * gameState.players.length);
    }

    console.log(`Play phase started. Starting player: ${gameState.players[gameState.currentPlayerIndex].name}`);

    // ギロチン時計の設定（大貧民がいる場合）
    if (gameState.ruleSettings.guillotineClock) {
      const daihinmin = gameState.players.find(p => p.rank === PlayerRank.DAIHINMIN);
      if (daihinmin && !daihinmin.isFinished) {
        await this.handleGuillotineClock(gameState, daihinmin);
      }
    }
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

    // 物資救援チェック（大貧民のターンで、場にカードがあり、未使用の場合）
    if (
      gameState.ruleSettings.supplyAid &&
      !gameState.supplyAidUsed &&
      currentPlayer.rank === PlayerRank.DAIHINMIN &&
      !gameState.field.isEmpty()
    ) {
      // 簡易実装: 場のカードが3枚以上なら自動発動（実際のUI実装では確認ダイアログを出す）
      const fieldHistory = gameState.field.getHistory();
      const fieldCardCount = fieldHistory.reduce((sum, h) => sum + h.play.cards.length, 0);
      if (fieldCardCount >= 3) {
        console.log(`${currentPlayer.name}が物資救援を発動！`);
        await this.presentationRequester.requestCutIns([{ effect: '物資救援', variant: 'gold' }]);
        await this.handleSupplyAid(gameState, currentPlayer);
        return null;
      }
    }

    // バリデーターを作成
    // RuleEngine.validate() は空配列でパス判定を行う
    const validator: Validator = {
      validate: (cards: Card[]) => {
        // ダイヤ3スタート: 最初のターンはダイヤ3を含める必要がある
        if (gameState.ruleSettings.diamond3Start && gameState.isFirstTurn && gameState.field.isEmpty()) {
          if (cards.length > 0) {
            const hasDiamond3 = cards.some(c => c.suit === Suit.DIAMOND && c.rank === '3');
            if (!hasDiamond3) {
              return { valid: false, reason: 'ダイヤ3スタート：最初のプレイにはダイヤ3を含める必要があります' };
            }
          }
        }

        // 大富豪の余裕: 大富豪は最初の1手で必ずパス
        if (gameState.ruleSettings.daifugoLeisure && !gameState.hasDaifugoPassedFirst) {
          if (currentPlayer.rank === PlayerRank.DAIFUGO) {
            if (cards.length > 0) {
              return { valid: false, reason: '大富豪の余裕：大富豪は最初の1手は必ずパスです' };
            }
            // パスの場合は valid: true を返すが、後続処理でフラグを立てる
          }
        }

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

    // テレフォースカウントダウン処理
    if (gameState.teleforceCountdown !== null) {
      gameState.teleforceCountdown--;
      console.log(`テレフォース：残り${gameState.teleforceCountdown}ターン`);

      if (gameState.teleforceCountdown <= 0) {
        console.log('テレフォース発動！全員敗北、残り手札で順位決定');
        this.handleTeleforceGameEnd(gameState);
        return null;
      }
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

    // ダイヤ3スタート: 最初のプレイが完了したらフラグを解除
    if (gameState.isFirstTurn) {
      gameState.isFirstTurn = false;
    }

    console.log(`${player.name} played ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);

    // ゲームログに記録
    this.presentationRequester.addLog({
      type: 'play',
      playerName: player.name,
      message: `${cards.length}枚のカードを出した`,
      cards: cards,
    });

    // 拾い食いチェック（大富豪がカードを出した後、大貧民が拾える）
    if (gameState.ruleSettings.scavenging && !gameState.scavengingUsed && player.rank === PlayerRank.DAIFUGO) {
      const daihinmin = gameState.players.find(p => p.rank === PlayerRank.DAIHINMIN && !p.isFinished);
      if (daihinmin) {
        // 簡易実装: 大貧民のコントローラーに拾うか確認（ここではCPUは常に拾う）
        const daihinminController = this.playerControllers.get(daihinmin.id.value);
        if (daihinminController) {
          console.log(`${daihinmin.name}に拾い食いの選択権があります`);
          // 自動で拾い食いを発動（実際のUI実装では確認ダイアログを出す）
          await this.handleScavenging(gameState, daihinmin);
          await this.presentationRequester.requestCutIns([{ effect: '拾い食い', variant: 'green' }]);
          // 大富豪はパス扱いで次のプレイヤーへ
          this.nextPlayer(gameState);
          return;
        }
      }
    }

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
      // エフェクトをログに記録
      for (const effect of effects) {
        this.presentationRequester.addLog({
          type: 'effect',
          playerName: player.name,
          message: `${effect}が発動`,
          effectName: effect,
        });
      }
    }

    // ソート
    if (effects.length > 0) {
      gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
    }

    // 場のクリア判定
    let shouldClearField = false;
    let salvagePlayer: Player | undefined = undefined;
    let nextAcePlayer: Player | undefined = undefined;

    if (gameState.isEightCutPending && !effects.includes('4止め') && !effects.includes('7カウンター') && !effects.includes('10返し')) {
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
    // 7カウンター: 8切り発生時にスペード7を出すと8切りをキャンセル
    if (effects.includes('7カウンター')) {
      console.log('7カウンターが発動しました！8切りがキャンセルされます');
      gameState.isEightCutPending = false;
    }
    // 10返し: 8切り発生時に同スートの10を出すと8切りをキャンセル
    if (effects.includes('10返し')) {
      console.log('10返しが発動しました！8切りがキャンセルされます');
      gameState.isEightCutPending = false;
    }
    // 8切り返し: 8切り発生時に8を重ねて自分の番に
    // 注意: 8切り返しは8切りをキャンセルせず、カウンターしたプレイヤーが親になる
    let eightCounterPlayer: Player | undefined = undefined;
    if (effects.includes('8切り返し')) {
      console.log('8切り返しが発動しました！カウンターしたプレイヤーが親になります');
      eightCounterPlayer = player;
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
    // ジョーカー返しで場が流れる（ジョーカー1枚に対してジョーカー1枚）
    if (effects.includes('ジョーカー返し')) {
      shouldClearField = true;
      console.log('ジョーカー返しが発動します');
    }
    // 威厳で場が流れる（J-Q-Kの階段）
    if (effects.includes('威厳')) {
      shouldClearField = true;
      console.log('威厳が発動します');
    }

    if (shouldClearField) {
      this.handleLuckySevenVictory(gameState);
      // 強化8切り: 8x3で場のカードをゲームから完全除外
      const excludeCards = effects.includes('強化8切り');
      await this.clearFieldAndResetState(gameState, true, salvagePlayer, nextAcePlayer, excludeCards);

      // 8切り返し: カウンターしたプレイヤーが親になる
      if (eightCounterPlayer && !eightCounterPlayer.isFinished) {
        const eightCounterIndex = gameState.players.findIndex(p => p.id.value === eightCounterPlayer!.id.value);
        if (eightCounterIndex !== -1) {
          gameState.currentPlayerIndex = eightCounterIndex;
          console.log(`8切り返し：${eightCounterPlayer.name} が親になりました`);
        }
      }
    }

    // 融合革命: 場札＋手札で4枚以上で革命、両者ターン休み（場が流れる）
    if (effects.includes('融合革命') || effects.includes('融合革命終了')) {
      console.log('融合革命が発動しました！両者ターン休み');
      // 場のカードを出したプレイヤーを特定
      const lastPlayHistory = gameState.field.getLastPlay();
      if (lastPlayHistory) {
        const fieldPlayer = gameState.players.find(p => p.id.value === lastPlayHistory.playerId.value);
        if (fieldPlayer && !fieldPlayer.isFinished && fieldPlayer.id.value !== player.id.value) {
          console.log(`${fieldPlayer.name} と ${player.name} はターン休みです`);
        }
      }
      // 場を流す
      await this.clearFieldAndResetState(gameState, true);
      // 次のプレイヤーに移動（融合革命を発動したプレイヤーの次の次）
      this.nextPlayer(gameState);
      this.nextPlayer(gameState);
      return;
    }

    // 追革: 場のペアと同数字ペアを重ねると革命、子は全員パス（場が流れる）
    if (effects.includes('追革') || effects.includes('追革終了')) {
      console.log('追革が発動しました！子は全員パス、場が流れます');
      // 場を流す
      await this.clearFieldAndResetState(gameState, true);
      // 追革を発動したプレイヤーがそのまま親になる（場が流れるのでshouldKeepTurnは自動的にtrue）
      return;
    }

    // 9クイック: 9を出すと続けてもう1回出せる（ターンを維持）
    const shouldKeepTurnForNineQuick = effects.includes('9クイック');
    // Qラブ: Q（階段以外）を出すと続けてもう1回出せる（ターンを維持）
    const shouldKeepTurnForQueenLove = effects.includes('Qラブ');
    const shouldKeepTurn = shouldClearField || shouldKeepTurnForNineQuick || shouldKeepTurnForQueenLove;

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

    // テポドンの即勝利処理（同数4枚＋ジョーカー2枚で革命＋即上がり）
    if (effects.includes('テポドン')) {
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

    // どかんの即勝利処理（場のカード合計=手札合計で無条件勝利）
    if (gameState.ruleSettings.dokan && this.checkDokanCondition(gameState, player)) {
      console.log(`どかんが発動しました！${player.name} が即勝利！`);
      await this.presentationRequester.requestCutIns([{ effect: 'どかん', variant: 'gold' }]);
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

    // ジャンヌダルク（Qx3で次のプレイヤーが手札から最強カード2枚を捨てる）
    if (effects.includes('ジャンヌダルク')) {
      await this.handleJeanneDArc(gameState, player);
    }

    // ブラッディメアリ（Qx3で全員が手札から最強カード2枚を捨てる）
    if (effects.includes('ブラッディメアリ')) {
      await this.handleBloodyMary(gameState, player);
    }

    // DEATH（4x3で全員が最強カードを捨てる）
    if (effects.includes('DEATH')) {
      await this.handleDeath(gameState, player);
    }

    // シーフ（4x3で次のプレイヤーから最強カードを奪う）
    if (effects.includes('シーフ')) {
      await this.handleThief(gameState, player);
    }

    // ジョーカー請求（4を出した時、次のプレイヤーがジョーカーを持っていれば奪う）
    if (effects.includes('ジョーカー請求')) {
      await this.handleJokerSeize(gameState, player);
    }

    // ネロ（Kx3で各対戦相手から最強カードを1枚ずつ奪う）
    if (effects.includes('ネロ')) {
      await this.handleNero(gameState, player);
    }

    // 王の特権（Kx3で左隣のプレイヤーと手札を全交換する）
    if (effects.includes('王の特権')) {
      await this.handleKingsPrivilege(gameState, player);
    }

    // 赤い5（♥5/♦5を1枚出すと指名者と手札をシャッフルして同数に再配布）
    if (effects.includes('赤い5')) {
      await this.handleRedFive(gameState, player);
    }

    // 名誉革命（4x4で革命せず、大富豪を大貧民に転落）
    if (effects.includes('名誉革命')) {
      await this.handleGloriousRevolution(gameState, player);
    }

    // 産業革命（3x4で全員の手札を見て1人1枚ずつ回収）
    if (effects.includes('産業革命')) {
      await this.handleIndustrialRevolution(gameState, player);
    }

    // 死の宣告（4x4で指名者は以降パスすると敗北）
    if (effects.includes('死の宣告')) {
      await this.handleDeathSentence(gameState, player);
    }

    // 闇市（Ax3で指名者と任意2枚⇔最強2枚を交換）
    if (effects.includes('闇市')) {
      await this.handleBlackMarket(gameState, player);
    }

    // 9賭け（9を出すと指名者がランダムで自分の手札を1枚捨てる）
    if (effects.includes('9賭け')) {
      await this.handleNineGamble(gameState, player);
    }

    // 9シャッフル（9x2で対戦相手の席順を自由に変更）
    if (effects.includes('9シャッフル')) {
      await this.handleNineShuffle(gameState, player);
    }

    // 終焉のカウントダウン（大貧民が4x1を出すとカウントダウン開始）
    if (effects.includes('終焉のカウントダウン')) {
      await this.handleEndCountdown(gameState, player);
    }

    // テレフォース（4x1を出すと7ターン後に全員敗北）
    if (effects.includes('テレフォース')) {
      await this.handleTeleforce(gameState);
    }

    // Aじゃないか（Ax4でゲーム終了、全員平民に）
    if (effects.includes('Aじゃないか')) {
      this.handleAceJanaiKa(gameState);
      return; // ゲーム終了なのでここで終了
    }

    // 十字軍（10x4で革命＋ジョーカー保持者から全ジョーカーを奪う）
    if (effects.includes('十字軍')) {
      await this.handleCrusade(gameState, player);
    }

    // オークション（10x3でジョーカー所持者から1枚ジョーカーを奪う）
    if (effects.includes('オークション')) {
      await this.handleAuction(gameState, player);
    }

    // 矢切の渡し（8を出すと8切り＋任意プレイヤーにカードを渡せる）
    if (effects.includes('矢切の渡し')) {
      await this.handleYagiriNoWatashi(gameState, player);
    }

    // カルテル（大貧民が3-4-5の階段を出すと大富豪以外は手札を見せ合える）
    if (effects.includes('カルテル')) {
      this.handleCartel(gameState, player);
    }

    // ババ落ち（ジョーカー含む5枚で革命→もう1枚のジョーカー所持者は敗北）
    if (effects.includes('ババ落ち')) {
      await this.handleBabaOchi(gameState, player);
    }

    // 片縛りの発動判定と適用
    this.checkAndApplyPartialLock(gameState, play);

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);

      // 上がり流し（finishFlow）: プレイヤーが上がった時に場が流れる
      if (gameState.ruleSettings.finishFlow) {
        console.log('上がり流しが発動します');
        await this.presentationRequester.requestCutIns([{ effect: '上がり流し', variant: 'green' }]);
        await this.clearFieldAndResetState(gameState, true);
      }

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

    // Qラブ（Q（階段以外）を出すと、枚数分だけ捨て札から回収）
    if (effects.includes('Qラブ')) {
      const queenCount = cards.filter(c => c.rank === 'Q').length;
      await this.handleQueenLove(gameState, player, queenCount);
    }

    // 死者蘇生（4を出すと、直前に出されたカードを枚数分手札に加える）
    if (effects.includes('死者蘇生')) {
      const fourCount = cards.filter(c => c.rank === '4').length;
      await this.handleResurrection(gameState, player, fourCount);
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

    // 情報公開系ルール（手札操作なし、コンソールログで表示）
    // 5ピック（5を出すと枚数分だけ好きなプレイヤーの手札を見れる）
    if (effects.includes('5ピック')) {
      const fiveCount = cards.filter(c => c.rank === '5').length;
      this.handleFivePick(gameState, player, fiveCount);
    }

    // 弱見せ（9を出すと次のプレイヤーの最弱カードを公開）
    if (effects.includes('弱見せ')) {
      this.handleWeakShow(gameState, player);
    }

    // 強見せ（6を出すと次のプレイヤーの最強カードを公開）
    if (effects.includes('強見せ')) {
      this.handleStrongShow(gameState, player);
    }

    // 暴君（2を出すと自分以外の全員が捨て札からランダムに1枚引く）
    if (effects.includes('暴君')) {
      this.handleTyrant(gameState, player);
    }

    // キング牧師（Kを出すと全員が右隣に任意カード1枚を渡す）
    if (effects.includes('キング牧師')) {
      await this.handleKingPastor(gameState);
    }

    // Re:KING（Kを出すと全員が捨て札からK枚数分ランダムに引く）
    if (effects.includes('Re:KING')) {
      const kingCount = cards.filter(c => c.rank === 'K').length;
      this.handleReKing(gameState, kingCount);
    }

    // A税収（子がAを出した時、直前のカードを手札に加え、次のプレイヤーをスキップ）
    if (effects.includes('A税収')) {
      await this.handleAceTax(gameState, player);
    }

    // 5スキップ・フリーメイソン・10飛び・A税収判定
    const shouldSkipNext = effects.includes('5スキップ') || effects.includes('フリーメイソン') || effects.includes('10飛び') || effects.includes('A税収');

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

    // ゲームログに記録
    this.presentationRequester.addLog({
      type: 'pass',
      playerName: player.name,
      message: 'パス',
    });

    // 大富豪の余裕: 大富豪がパスした場合、フラグを立てる
    if (gameState.ruleSettings.daifugoLeisure && player.rank === PlayerRank.DAIFUGO && !gameState.hasDaifugoPassedFirst) {
      gameState.hasDaifugoPassedFirst = true;
      console.log('大富豪の余裕：大富豪がパスしました');
    }

    // ダミアン発動中はパスしたプレイヤーが敗北
    if (gameState.isDamianActive) {
      console.log(`ダミアン発動中！${player.name} はパスしたため敗北`);
      this.handlePlayerDefeat(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 死の宣告対象がパスすると敗北
    if (gameState.deathSentenceTarget === player.id.value) {
      console.log(`死の宣告発動！${player.name} はパスしたため敗北`);
      gameState.deathSentenceTarget = null; // 宣告解除
      this.handlePlayerDefeat(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 終焉のカウントダウン発動中はパスするとカウントが減少
    if (gameState.endCountdownValue !== null) {
      gameState.endCountdownValue--;
      console.log(`終焉のカウントダウン：残り${gameState.endCountdownValue}`);

      if (gameState.endCountdownValue <= 0) {
        console.log(`終焉のカウントダウン発動！${player.name} はカウント0でパスしたため敗北`);
        gameState.endCountdownValue = null; // カウントダウン解除
        this.handlePlayerDefeat(gameState, player);
        this.nextPlayer(gameState);
        return;
      }
    }

    // ギロチン時計発動中はパスするとカウントが減少
    if (gameState.guillotineClockCount !== null) {
      gameState.guillotineClockCount--;
      console.log(`ギロチン時計：残り${gameState.guillotineClockCount}回パス`);

      if (gameState.guillotineClockCount <= 0) {
        console.log(`ギロチン時計発動！${player.name} はカウント0でパスしたため敗北`);
        gameState.guillotineClockCount = null;
        this.handlePlayerDefeat(gameState, player);
        this.nextPlayer(gameState);
        return;
      }
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

    // ゲームログに記録
    this.presentationRequester.addLog({
      type: 'finish',
      playerName: player.name,
      message: `${player.finishPosition}位で上がり`,
    });

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
   * @param excludeCards 強化8切り時にカードを完全除外するか（捨て札にも行かない）
   */
  private async clearFieldAndResetState(
    gameState: GameState,
    resetElevenBack: boolean = true,
    salvagePlayer?: Player,
    nextAcePlayer?: Player,
    excludeCards: boolean = false
  ): Promise<void> {
    // 場のカードを捨て札または除外リストに移動
    const history = gameState.field.getHistory();
    for (const playHistory of history) {
      if (excludeCards) {
        // 強化8切り: カードをゲームから完全除外
        gameState.excludedCards.push(...playHistory.play.cards);
        console.log(`強化8切り: ${playHistory.play.cards.map(c => `${c.rank}${c.suit}`).join(', ')} をゲームから除外`);
      } else {
        gameState.discardPile.push(...playHistory.play.cards);
      }
    }

    gameState.field.clear();
    gameState.passCount = 0;
    gameState.isEightCutPending = false;
    gameState.suitLock = null;
    gameState.numberLock = false;
    gameState.colorLock = null;
    gameState.isTwoBack = false; // 2バックをリセット
    gameState.isDamianActive = false; // ダミアンをリセット
    gameState.parityRestriction = null; // 偶数/奇数制限をリセット
    gameState.isTenFreeActive = false; // 10フリをリセット
    gameState.isDoubleDigitSealActive = false; // 2桁封じをリセット
    gameState.hotMilkRestriction = null; // ホットミルクをリセット
    gameState.isArthurActive = false; // アーサーをリセット
    gameState.partialLockSuits = null; // 片縛りをリセット

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
    // 5色縛りの場合、5のカードの色を判定してコンテキストに含める
    let color: 'red' | 'black' | undefined;
    if (effect === '5色縛り' && play) {
      const fiveCard = play.cards.find(c => c.rank === '5');
      if (fiveCard) {
        color = (fiveCard.suit === Suit.HEART || fiveCard.suit === Suit.DIAMOND) ? 'red' : 'black';
      }
    }
    this.effectHandler.apply(effect, gameState, { player, suit, color });
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
      '5ピック': { effect: '5ピック', variant: 'blue' },
      '弱見せ': { effect: '弱見せ', variant: 'green' },
      '強見せ': { effect: '強見せ', variant: 'red' },
      '暴君': { effect: '暴君', variant: 'red' },
      'ジョーカー返し': { effect: 'ジョーカー返し', variant: 'gold' },
      '7カウンター': { effect: '7カウンター', variant: 'blue' },
      '偶数制限': { effect: '偶数制限', variant: 'blue' },
      '奇数制限': { effect: '奇数制限', variant: 'blue' },
      '10フリ': { effect: '10フリ', variant: 'green' },
      '死者蘇生': { effect: '死者蘇生', variant: 'gold' },
      'ジャンヌダルク': { effect: 'ジャンヌダルク', variant: 'gold' },
      'ブラッディメアリ': { effect: 'ブラッディメアリ', variant: 'red' },
      'キング牧師': { effect: 'キング牧師', variant: 'gold' },
      'Re:KING': { effect: 'Re:KING', variant: 'gold' },
      'DEATH': { effect: 'DEATH', variant: 'red' },
      'シーフ': { effect: 'シーフ', variant: 'blue' },
      '2桁封じ': { effect: '2桁封じ', variant: 'blue' },
      'ホットミルク': { effect: 'ホットミルク', variant: 'yellow' },
      'A税収': { effect: 'A税収', variant: 'gold' },
      'ジョーカー請求': { effect: 'ジョーカー請求', variant: 'gold' },
      'Qラブ': { effect: 'Qラブ', variant: 'red' },
      '5色縛り': { effect: '5色縛り', variant: 'blue' },
      '威厳': { effect: '威厳', variant: 'gold' },
      'ネロ': { effect: 'ネロ', variant: 'red' },
      '王の特権': { effect: '王の特権', variant: 'gold' },
      'アーサー': { effect: 'アーサー', variant: 'gold' },
      '赤い5': { effect: '赤い5', variant: 'red' },
      '名誉革命': { effect: '名誉革命', variant: 'gold' },
      '産業革命': { effect: '産業革命', variant: 'gold' },
      '死の宣告': { effect: '死の宣告', variant: 'red' },
      '闇市': { effect: '闇市', variant: 'gold' },
      '9賭け': { effect: '9賭け', variant: 'yellow' },
      '9シャッフル': { effect: '9シャッフル', variant: 'blue' },
      '6もらい': { effect: '6もらい', variant: 'green' },
      '9もらい': { effect: '9もらい', variant: 'green' },
      '終焉のカウントダウン': { effect: '終焉のカウントダウン', variant: 'red' },
      'テレフォース': { effect: 'テレフォース', variant: 'red' },
      '10返し': { effect: '10返し', variant: 'blue' },
      '強化8切り': { effect: '強化8切り', variant: 'red' },
      '矢切の渡し': { effect: '矢切の渡し', variant: 'blue' },
      '8切り返し': { effect: '8切り返し', variant: 'green' },
      '物資救援': { effect: '物資救援', variant: 'gold' },
      '拾い食い': { effect: '拾い食い', variant: 'green' },
      'カルテル': { effect: 'カルテル', variant: 'blue' },
      'ギロチン時計': { effect: 'ギロチン時計', variant: 'red' },
      '飛び連番革命': { effect: '飛び連番革命', variant: 'red' },
      '飛び連番革命終了': { effect: '飛び連番革命終了', variant: 'blue' },
      '宗教革命': { effect: '宗教革命', variant: 'gold' },
      '超革命': { effect: '超革命', variant: 'gold' },
      '超革命終了': { effect: '超革命終了', variant: 'blue' },
      '革命流し': { effect: '革命流し', variant: 'green' },
      'テポドン': { effect: 'テポドン', variant: 'gold' },
      'どかん': { effect: 'どかん', variant: 'gold' },
      '融合革命': { effect: '融合革命', variant: 'red' },
      '融合革命終了': { effect: '融合革命終了', variant: 'blue' },
      '追革': { effect: '追革', variant: 'red' },
      '追革終了': { effect: '追革終了', variant: 'blue' },
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

  /**
   * 5ピック処理
   * 5を出すと、出した5の枚数分だけ好きなプレイヤーの手札を見れる
   * @param fiveCount 出された5の枚数（＝見れるプレイヤー数）
   */
  private handleFivePick(gameState: GameState, player: Player, fiveCount: number): void {
    // 自分以外のアクティブなプレイヤーを取得
    const otherPlayers = gameState.players.filter(p => !p.isFinished && p.id.value !== player.id.value);

    if (otherPlayers.length === 0) {
      console.log('5ピック：見れるプレイヤーがいません');
      return;
    }

    // 見れるプレイヤー数は、他のプレイヤー数と5の枚数の小さい方
    const viewCount = Math.min(fiveCount, otherPlayers.length);

    console.log(`5ピック発動！${player.name} が ${viewCount} 人の手札を見ます`);

    // 簡易的に先頭から viewCount 人の手札を表示（本来はプレイヤーが選択）
    for (let i = 0; i < viewCount; i++) {
      const targetPlayer = otherPlayers[i];
      const cards = targetPlayer.hand.getCards();
      const cardStrings = cards.map(c => `${c.rank}${c.suit}`).join(', ');
      console.log(`  ${targetPlayer.name} の手札: ${cardStrings}`);
    }
  }

  /**
   * 弱見せ処理
   * 9を出すと、次のプレイヤーの最弱カードを公開
   */
  private handleWeakShow(gameState: GameState, _player: Player): void {
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    let nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let nextPlayer = gameState.players[nextIndex];

    let attempts = 0;
    while (nextPlayer.isFinished && attempts < gameState.players.length) {
      nextIndex = (nextIndex + direction + gameState.players.length) % gameState.players.length;
      nextPlayer = gameState.players[nextIndex];
      attempts++;
    }

    if (nextPlayer.isFinished || nextPlayer.hand.isEmpty()) {
      console.log('弱見せ：対象プレイヤーがいないかカードがありません');
      return;
    }

    // 最弱カードを取得（革命/11バックを考慮）
    const cards = nextPlayer.hand.getCards();
    let weakestCard = cards[0];
    let weakestStrength = this.getCardStrength(weakestCard.rank, shouldReverse);

    for (const card of cards) {
      const strength = this.getCardStrength(card.rank, shouldReverse);
      // 弱いカード = 強さが小さい（革命時は反転済み）
      if (strength < weakestStrength) {
        weakestStrength = strength;
        weakestCard = card;
      }
    }

    console.log(`弱見せ発動！${nextPlayer.name} の最弱カード: ${weakestCard.rank}${weakestCard.suit}`);
  }

  /**
   * 強見せ処理
   * 6を出すと、次のプレイヤーの最強カードを公開
   */
  private handleStrongShow(gameState: GameState, _player: Player): void {
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    let nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let nextPlayer = gameState.players[nextIndex];

    let attempts = 0;
    while (nextPlayer.isFinished && attempts < gameState.players.length) {
      nextIndex = (nextIndex + direction + gameState.players.length) % gameState.players.length;
      nextPlayer = gameState.players[nextIndex];
      attempts++;
    }

    if (nextPlayer.isFinished || nextPlayer.hand.isEmpty()) {
      console.log('強見せ：対象プレイヤーがいないかカードがありません');
      return;
    }

    // 最強カードを取得（革命/11バックを考慮）
    const cards = nextPlayer.hand.getCards();
    let strongestCard = cards[0];
    let strongestStrength = this.getCardStrength(strongestCard.rank, shouldReverse);

    for (const card of cards) {
      const strength = this.getCardStrength(card.rank, shouldReverse);
      // 強いカード = 強さが大きい（革命時は反転済み）
      if (strength > strongestStrength) {
        strongestStrength = strength;
        strongestCard = card;
      }
    }

    console.log(`強見せ発動！${nextPlayer.name} の最強カード: ${strongestCard.rank}${strongestCard.suit}`);
  }

  /**
   * 暴君処理
   * 2を出すと、自分以外の全員が捨て札からランダムに1枚引く
   */
  private handleTyrant(gameState: GameState, player: Player): void {
    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('暴君：捨て札がないためスキップ');
      return;
    }

    console.log(`暴君発動！${player.name} 以外の全員が捨て札からランダムに1枚引きます`);

    // 自分以外のアクティブなプレイヤーが捨て札からランダムに1枚引く
    for (const p of gameState.players) {
      // 自分はスキップ
      if (p.id.value === player.id.value) continue;
      // 終了したプレイヤーはスキップ
      if (p.isFinished) continue;
      // 捨て札がなくなったらスキップ
      if (gameState.discardPile.length === 0) {
        console.log(`暴君：捨て札がなくなったため ${p.name} はスキップ`);
        continue;
      }

      // ランダムなインデックスを選択
      const randomIndex = Math.floor(Math.random() * gameState.discardPile.length);
      const card = gameState.discardPile.splice(randomIndex, 1)[0];

      // プレイヤーの手札に追加
      p.hand.add([card]);
      console.log(`暴君：${p.name} が ${card.rank}${card.suit} を引きました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      p.hand.sort(shouldReverse);
    }
  }

  /**
   * 死者蘇生処理（非同期）
   * 4を出すと、直前に出されたカードを枚数分手札に加える
   * @param fourCount 出された4の枚数（＝回収できる枚数の上限）
   */
  private async handleResurrection(gameState: GameState, player: Player, fourCount: number): Promise<void> {
    // 場の履歴から直前のプレイを取得（自分が今出したプレイの1つ前）
    const history = gameState.field.getHistory();
    if (history.length < 2) {
      console.log('死者蘇生：直前のプレイがないためスキップ');
      return;
    }

    // history の最後は今出したプレイなので、その1つ前を取得
    const previousPlay = history[history.length - 2];
    const previousCards = previousPlay.play.cards;

    if (previousCards.length === 0) {
      console.log('死者蘇生：直前のプレイにカードがないためスキップ');
      return;
    }

    // 回収できる枚数 = min(直前のカード枚数, 4の枚数)
    const recoverCount = Math.min(previousCards.length, fourCount);

    console.log(`死者蘇生：${player.name} が直前のカードから${recoverCount}枚回収します`);

    // 直前のカードから recoverCount 枚を手札に追加
    // 注意: 場のカードは field.clear() まで残っているので、ここではコピーを手札に追加
    const cardsToRecover = previousCards.slice(0, recoverCount);

    // カードのコピーを作成（元のカードは場に残る）
    // 実際にはカードの参照を渡すだけで、場が流れる時に捨て札に移動される
    // ここでは直接手札に追加する
    player.hand.add(cardsToRecover);
    console.log(`${player.name} が ${cardsToRecover.map(c => `${c.rank}${c.suit}`).join(', ')} を回収しました（死者蘇生）`);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
  }

  /**
   * ジャンヌダルク処理
   * Qx3で次のプレイヤーが手札から最強カード2枚を捨てる
   */
  private async handleJeanneDArc(gameState: GameState, _player: Player): Promise<void> {
    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    let nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let targetPlayer = gameState.players[nextIndex];

    let attempts = 0;
    while (targetPlayer.isFinished && attempts < gameState.players.length) {
      nextIndex = (nextIndex + direction + gameState.players.length) % gameState.players.length;
      targetPlayer = gameState.players[nextIndex];
      attempts++;
    }

    if (targetPlayer.isFinished) {
      console.log('ジャンヌダルク：対象プレイヤーがいません');
      return;
    }

    // 最強カードを取得して捨てる
    const discardCount = Math.min(2, targetPlayer.hand.getCards().length);
    if (discardCount === 0) {
      console.log(`ジャンヌダルク：${targetPlayer.name} は手札がありません`);
      return;
    }

    const cardsToDiscard = this.getStrongestCards(targetPlayer, gameState, discardCount);
    targetPlayer.hand.remove(cardsToDiscard);
    gameState.discardPile.push(...cardsToDiscard);

    console.log(`ジャンヌダルク：${targetPlayer.name} が ${cardsToDiscard.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

    if (targetPlayer.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, targetPlayer);
    }
  }

  /**
   * ブラッディメアリ処理
   * Qx3で全員が手札から最強カード2枚を捨てる
   */
  private async handleBloodyMary(gameState: GameState, _player: Player): Promise<void> {
    console.log('ブラッディメアリ：全員が最強カード2枚を捨てます');

    for (const targetPlayer of gameState.players) {
      if (targetPlayer.isFinished) continue;

      const discardCount = Math.min(2, targetPlayer.hand.getCards().length);
      if (discardCount === 0) {
        console.log(`ブラッディメアリ：${targetPlayer.name} は手札がありません`);
        continue;
      }

      const cardsToDiscard = this.getStrongestCards(targetPlayer, gameState, discardCount);
      targetPlayer.hand.remove(cardsToDiscard);
      gameState.discardPile.push(...cardsToDiscard);

      console.log(`ブラッディメアリ：${targetPlayer.name} が ${cardsToDiscard.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

      if (targetPlayer.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, targetPlayer);
      }
    }
  }

  /**
   * プレイヤーの手札から最強カードを指定枚数取得する
   * 革命/11バック状態を考慮
   */
  private getStrongestCards(player: Player, gameState: GameState, count: number): Card[] {
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    const cards = [...player.hand.getCards()];

    // 強さ順にソート（降順）
    cards.sort((a, b) => {
      const strengthA = this.getCardStrength(a.rank, shouldReverse);
      const strengthB = this.getCardStrength(b.rank, shouldReverse);
      return strengthB - strengthA; // 降順
    });

    return cards.slice(0, count);
  }

  /**
   * キング牧師処理（非同期）
   * Kを出すと全員が右隣のプレイヤーに任意カード1枚を渡す
   * CPUの場合は最弱カードを渡す
   */
  private async handleKingPastor(gameState: GameState): Promise<void> {
    console.log('キング牧師発動！全員が右隣のプレイヤーにカードを1枚渡します');

    const activePlayers = gameState.players.filter(p => !p.isFinished && p.hand.getCards().length > 0);

    if (activePlayers.length < 2) {
      console.log('キング牧師：渡せるプレイヤーが足りないためスキップ');
      return;
    }

    // 各プレイヤーが渡すカードを収集（同時に選択するイメージ）
    const cardsToPass: Map<string, Card> = new Map();

    for (const player of activePlayers) {
      const controller = this.playerControllers.get(player.id.value);
      if (!controller) continue;

      // バリデーター: 1枚だけ選択可能
      const validator: Validator = {
        validate: (cards: Card[]) => {
          if (cards.length === 1) {
            return { valid: true };
          }
          return { valid: false, reason: '1枚選んでください' };
        }
      };

      const cards = await controller.chooseCardsInHand(
        validator,
        `キング牧師：右隣のプレイヤーに渡すカードを1枚選んでください`
      );

      if (cards.length === 1) {
        cardsToPass.set(player.id.value, cards[0]);
      }
    }

    // カードを右隣のプレイヤーに渡す（席順で右隣 = 次のプレイヤー）
    // リバース状態でも物理的な右隣に渡す（ゲームの進行方向とは関係ない）
    for (const player of activePlayers) {
      const cardToPass = cardsToPass.get(player.id.value);
      if (!cardToPass) continue;

      // 右隣のプレイヤーを探す（物理的な位置で、インデックス+1）
      const currentIndex = gameState.players.indexOf(player);
      let rightNeighborIndex = (currentIndex + 1) % gameState.players.length;

      // 右隣がfinishedなら次を探す
      let attempts = 0;
      while (gameState.players[rightNeighborIndex].isFinished && attempts < gameState.players.length) {
        rightNeighborIndex = (rightNeighborIndex + 1) % gameState.players.length;
        attempts++;
      }

      const rightNeighbor = gameState.players[rightNeighborIndex];
      if (rightNeighbor.isFinished) continue;

      // カードを渡す
      player.hand.remove([cardToPass]);
      rightNeighbor.hand.add([cardToPass]);
      console.log(`${player.name} が ${rightNeighbor.name} に ${cardToPass.rank}${cardToPass.suit} を渡しました（キング牧師）`);
    }

    // 全員の手札をソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    for (const player of gameState.players) {
      if (!player.isFinished) {
        player.hand.sort(shouldReverse);
      }
    }

    // 手札が空になったプレイヤーの処理
    for (const player of gameState.players) {
      if (!player.isFinished && player.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, player);
      }
    }
  }

  /**
   * Re:KING処理
   * Kを出すと全員が捨て札からK枚数分ランダムに引く
   * @param kingCount 出されたKの枚数（＝引く枚数）
   */
  private handleReKing(gameState: GameState, kingCount: number): void {
    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('Re:KING：捨て札がないためスキップ');
      return;
    }

    console.log(`Re:KING発動！全員が捨て札から${kingCount}枚ずつランダムに引きます`);

    // 全てのアクティブなプレイヤーが捨て札からランダムにカードを引く
    for (const player of gameState.players) {
      // 終了したプレイヤーはスキップ
      if (player.isFinished) continue;

      // 捨て札がなくなったらスキップ
      if (gameState.discardPile.length === 0) {
        console.log(`Re:KING：捨て札がなくなったため ${player.name} はスキップ`);
        continue;
      }

      // 引ける枚数 = min(捨て札の枚数, Kの枚数)
      const drawCount = Math.min(gameState.discardPile.length, kingCount);

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
        console.log(`Re:KING：${player.name} が ${drawnCards.map(c => `${c.rank}${c.suit}`).join(', ')} を引きました`);

        // ソート
        const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
        player.hand.sort(shouldReverse);
      }
    }
  }

  /**
   * DEATH処理
   * 4x3で全員が最強カードを捨てる
   */
  private async handleDeath(gameState: GameState, _player: Player): Promise<void> {
    console.log('DEATH発動！全員が最強カードを捨てます');

    for (const targetPlayer of gameState.players) {
      if (targetPlayer.isFinished) continue;
      if (targetPlayer.hand.isEmpty()) continue;

      const cardsToDiscard = this.getStrongestCards(targetPlayer, gameState, 1);
      if (cardsToDiscard.length > 0) {
        targetPlayer.hand.remove(cardsToDiscard);
        gameState.discardPile.push(...cardsToDiscard);
        console.log(`DEATH：${targetPlayer.name} が ${cardsToDiscard.map(c => `${c.rank}${c.suit}`).join(', ')} を捨てました`);

        if (targetPlayer.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, targetPlayer);
        }
      }
    }
  }

  /**
   * シーフ処理
   * 4x3で次のプレイヤーから最強カードを奪う
   */
  private async handleThief(gameState: GameState, player: Player): Promise<void> {
    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    let nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let targetPlayer = gameState.players[nextIndex];

    let attempts = 0;
    while (targetPlayer.isFinished && attempts < gameState.players.length) {
      nextIndex = (nextIndex + direction + gameState.players.length) % gameState.players.length;
      targetPlayer = gameState.players[nextIndex];
      attempts++;
    }

    if (targetPlayer.isFinished || targetPlayer.hand.isEmpty()) {
      console.log('シーフ：対象プレイヤーがいないか手札がありません');
      return;
    }

    console.log(`シーフ発動！${player.name} が ${targetPlayer.name} から最強カードを奪います`);

    const cardsToSteal = this.getStrongestCards(targetPlayer, gameState, 1);
    if (cardsToSteal.length > 0) {
      targetPlayer.hand.remove(cardsToSteal);
      player.hand.add(cardsToSteal);
      console.log(`シーフ：${player.name} が ${targetPlayer.name} から ${cardsToSteal.map(c => `${c.rank}${c.suit}`).join(', ')} を奪いました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);

      if (targetPlayer.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, targetPlayer);
      }
    }
  }

  /**
   * A税収処理
   * 子がAを出した時、直前のカードを手札に加える
   * （次のプレイヤーのスキップはshouldSkipNextで処理）
   */
  private async handleAceTax(gameState: GameState, player: Player): Promise<void> {
    // 場の履歴から直前のプレイを取得（自分が今出したプレイの1つ前）
    const history = gameState.field.getHistory();
    if (history.length < 2) {
      console.log('A税収：直前のプレイがないためスキップ');
      return;
    }

    // history の最後は今出したプレイなので、その1つ前を取得
    const previousPlay = history[history.length - 2];
    const previousCards = previousPlay.play.cards;

    if (previousCards.length === 0) {
      console.log('A税収：直前のプレイにカードがないためスキップ');
      return;
    }

    // 直前のカードを手札に加える
    player.hand.add(previousCards);
    console.log(`A税収：${player.name} が ${previousCards.map(c => `${c.rank}${c.suit}`).join(', ')} を手札に加えました`);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
  }

  /**
   * ネロ処理
   * Kx3で各対戦相手から最強カードを1枚ずつ奪う
   */
  private async handleNero(gameState: GameState, player: Player): Promise<void> {
    console.log(`ネロ発動！${player.name} が全員から最強カードを奪います`);

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    for (const targetPlayer of gameState.players) {
      // 自分と上がったプレイヤーはスキップ
      if (targetPlayer.id.value === player.id.value || targetPlayer.isFinished) continue;
      if (targetPlayer.hand.isEmpty()) continue;

      const cardsToSteal = this.getStrongestCards(targetPlayer, gameState, 1);
      if (cardsToSteal.length > 0) {
        targetPlayer.hand.remove(cardsToSteal);
        player.hand.add(cardsToSteal);
        console.log(`ネロ：${player.name} が ${targetPlayer.name} から ${cardsToSteal.map(c => `${c.rank}${c.suit}`).join(', ')} を奪いました`);

        if (targetPlayer.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, targetPlayer);
        }
      }
    }

    // ソート
    player.hand.sort(shouldReverse);
  }

  /**
   * 王の特権処理
   * Kx3で左隣のプレイヤーと手札を全交換する
   */
  private async handleKingsPrivilege(gameState: GameState, player: Player): Promise<void> {
    // 左隣のプレイヤーを探す（物理的な位置でインデックス-1）
    const currentIndex = gameState.players.indexOf(player);
    let leftNeighborIndex = (currentIndex - 1 + gameState.players.length) % gameState.players.length;

    // 左隣がfinishedなら次を探す
    let attempts = 0;
    while (gameState.players[leftNeighborIndex].isFinished && attempts < gameState.players.length) {
      leftNeighborIndex = (leftNeighborIndex - 1 + gameState.players.length) % gameState.players.length;
      attempts++;
    }

    const leftNeighbor = gameState.players[leftNeighborIndex];
    if (leftNeighbor.isFinished || leftNeighbor.id.value === player.id.value) {
      console.log('王の特権：交換対象がいません');
      return;
    }

    console.log(`王の特権発動！${player.name} と ${leftNeighbor.name} が手札を全交換します`);

    // 手札を交換
    const playerCards = [...player.hand.getCards()];
    const neighborCards = [...leftNeighbor.hand.getCards()];

    player.hand.remove(playerCards);
    leftNeighbor.hand.remove(neighborCards);

    player.hand.add(neighborCards);
    leftNeighbor.hand.add(playerCards);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
    leftNeighbor.hand.sort(shouldReverse);

    console.log(`王の特権：${player.name} は ${neighborCards.length}枚、${leftNeighbor.name} は ${playerCards.length}枚の手札になりました`);
  }

  /**
   * ジョーカー請求処理
   * 4を出した時、次のプレイヤーがジョーカーを持っていれば奪う
   */
  private async handleJokerSeize(gameState: GameState, player: Player): Promise<void> {
    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    let nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let targetPlayer = gameState.players[nextIndex];

    let attempts = 0;
    while (targetPlayer.isFinished && attempts < gameState.players.length) {
      nextIndex = (nextIndex + direction + gameState.players.length) % gameState.players.length;
      targetPlayer = gameState.players[nextIndex];
      attempts++;
    }

    if (targetPlayer.isFinished) {
      console.log('ジョーカー請求：対象プレイヤーがいません');
      return;
    }

    // ジョーカーを持っているか確認
    const jokers = targetPlayer.hand.getCards().filter(c => c.rank === 'JOKER');
    if (jokers.length === 0) {
      console.log(`ジョーカー請求：${targetPlayer.name} はジョーカーを持っていません`);
      return;
    }

    // ジョーカーを1枚奪う
    const jokerToSteal = jokers[0];
    targetPlayer.hand.remove([jokerToSteal]);
    player.hand.add([jokerToSteal]);
    console.log(`ジョーカー請求：${player.name} が ${targetPlayer.name} からジョーカーを奪いました`);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
  }

  /**
   * Qラブ処理
   * Q（階段以外）を出すと、枚数分だけ捨て札から回収
   * （連続ターンはshouldKeepTurnForQueenLoveで処理）
   */
  private async handleQueenLove(gameState: GameState, player: Player, queenCount: number): Promise<void> {
    // 捨て札がなければスキップ
    if (gameState.discardPile.length === 0) {
      console.log('Qラブ：捨て札がないためスキップ');
      return;
    }

    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('Qラブ：コントローラーがないためスキップ');
      return;
    }

    // 回収できる枚数 = min(捨て札の枚数, Qの枚数)
    const maxRecovery = Math.min(gameState.discardPile.length, queenCount);

    console.log(`Qラブ：${player.name} が捨て札から${maxRecovery}枚まで回収できます`);

    // カード選択
    const selectedCards = await controller.chooseCardsFromDiscard(
      gameState.discardPile,
      maxRecovery,
      `Qラブ：捨て札から${maxRecovery}枚まで選んでください`
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
      console.log(`${player.name} が ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')} を回収しました（Qラブ）`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
    }
  }

  /**
   * 赤い5処理
   * ♥5/♦5を1枚出すと指名者と手札をシャッフルして同数に再配布
   */
  private async handleRedFive(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('赤い5：コントローラーがないためスキップ');
      return;
    }

    // 指名可能なプレイヤー（自分以外でまだ上がっていないプレイヤー）
    const targetPlayers = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished && !p.hand.isEmpty()
    );

    if (targetPlayers.length === 0) {
      console.log('赤い5：対象プレイヤーがいないためスキップ');
      return;
    }

    // プレイヤーIDと名前のマップを作成
    const playerIds = targetPlayers.map(p => p.id.value);
    const playerNames = new Map(targetPlayers.map(p => [p.id.value, p.name]));

    // プレイヤーを指名
    const targetPlayerId = await controller.choosePlayerForBlackMarket(
      playerIds,
      playerNames,
      '赤い5：手札を交換するプレイヤーを選んでください'
    );

    const targetPlayer = targetPlayers.find(p => p.id.value === targetPlayerId);
    if (!targetPlayer) {
      console.log('赤い5：プレイヤーが選択されませんでした');
      return;
    }

    console.log(`赤い5発動！${player.name} と ${targetPlayer.name} の手札をシャッフルして再配布します`);

    // 両者の手札を合わせる
    const allCards = [...player.hand.getCards(), ...targetPlayer.hand.getCards()];

    // シャッフル
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }

    // 同数に再配布（元の枚数を維持）
    const playerOriginalCount = player.hand.getCards().length;
    const targetOriginalCount = targetPlayer.hand.getCards().length;

    // 手札をクリア
    player.hand.remove([...player.hand.getCards()]);
    targetPlayer.hand.remove([...targetPlayer.hand.getCards()]);

    // 再配布
    const playerNewCards = allCards.slice(0, playerOriginalCount);
    const targetNewCards = allCards.slice(playerOriginalCount, playerOriginalCount + targetOriginalCount);

    player.hand.add(playerNewCards);
    targetPlayer.hand.add(targetNewCards);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
    targetPlayer.hand.sort(shouldReverse);

    console.log(`赤い5：${player.name} は ${playerNewCards.length}枚、${targetPlayer.name} は ${targetNewCards.length}枚の手札になりました`);
  }

  /**
   * 名誉革命処理
   * 4x4で革命せず、大富豪を大貧民に転落
   */
  private async handleGloriousRevolution(gameState: GameState, _player: Player): Promise<void> {
    // 大富豪のプレイヤーを探す
    const daifugo = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);

    if (!daifugo) {
      console.log('名誉革命：大富豪がいないためスキップ');
      return;
    }

    console.log(`名誉革命発動！${daifugo.name} が大富豪から大貧民に転落します`);

    // 大富豪のランクを大貧民に変更
    daifugo.rank = PlayerRank.DAIHINMIN;

    console.log(`名誉革命：${daifugo.name} のランクが大貧民になりました`);
  }

  /**
   * 産業革命処理（3x4で全員の手札を見て1人1枚ずつ回収）
   * プレイヤーが各対戦相手の手札を見て、1枚ずつカードを奪う
   */
  private async handleIndustrialRevolution(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('産業革命：コントローラーがないためスキップ');
      return;
    }

    console.log(`産業革命：${player.name} が全員の手札を見て1人1枚ずつ回収します`);

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    // 各対戦相手から1枚ずつ奪う
    for (const opponent of gameState.players) {
      // 自分自身はスキップ
      if (opponent.id.value === player.id.value) continue;
      // 終了したプレイヤーはスキップ
      if (opponent.isFinished) continue;
      // 手札がないプレイヤーはスキップ
      if (opponent.hand.isEmpty()) continue;

      const opponentCards = [...opponent.hand.getCards()];
      console.log(`産業革命：${opponent.name} の手札: ${opponentCards.map(c => `${c.rank}${c.suit}`).join(', ')}`);

      // プレイヤーにカードを選ばせる
      const selectedCards = await controller.chooseCardsFromOpponentHand(
        opponentCards,
        1,
        `産業革命：${opponent.name} の手札から1枚選んでください`
      );

      if (selectedCards.length > 0) {
        const card = selectedCards[0];
        opponent.hand.remove([card]);
        player.hand.add([card]);
        console.log(`${player.name} が ${opponent.name} から ${card.rank}${card.suit} を奪いました（産業革命）`);

        // ソート
        player.hand.sort(shouldReverse);
        opponent.hand.sort(shouldReverse);
      }
    }
  }

  /**
   * 死の宣告処理（4x4で指名者は以降パスすると敗北）
   * プレイヤーが対戦相手を1人指名し、その相手は以降パスすると敗北
   */
  private async handleDeathSentence(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('死の宣告：コントローラーがないためスキップ');
      return;
    }

    // 指名可能な対戦相手（自分以外でまだ終了していないプレイヤー）
    const targets = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished
    );

    if (targets.length === 0) {
      console.log('死の宣告：指名可能な対戦相手がいません');
      return;
    }

    console.log(`死の宣告：${player.name} が対戦相手を指名します`);

    // プレイヤーに対戦相手を選ばせる
    const targetPlayer = await controller.choosePlayer(
      targets,
      '死の宣告：対象プレイヤーを選んでください'
    );

    if (targetPlayer) {
      gameState.deathSentenceTarget = targetPlayer.id.value;
      console.log(`死の宣告：${targetPlayer.name} が指名されました。パスすると敗北します。`);
    }
  }

  /**
   * 闇市処理（非同期）
   * Ax3で指名者と任意2枚⇔最強2枚を交換
   */
  private async handleBlackMarket(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('闇市：コントローラーがないためスキップ');
      return;
    }

    // 自分以外のアクティブプレイヤーを取得
    const targetPlayers = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished && p.hand.size() >= 2
    );

    if (targetPlayers.length === 0) {
      console.log('闇市：対象プレイヤーがいません');
      return;
    }

    // プレイヤー選択
    const targetPlayer = await controller.choosePlayer(
      targetPlayers,
      '闇市：交換相手を選んでください'
    );

    if (!targetPlayer || targetPlayer.isFinished) {
      console.log('闇市：対象プレイヤーが見つかりません');
      return;
    }

    console.log(`闇市発動！${player.name} が ${targetPlayer.name} と交換します`);

    // 自分の手札から2枚選択
    const handCards = player.hand.getCards();
    const cardsToGiveCount = Math.min(2, handCards.length);

    if (cardsToGiveCount === 0) {
      console.log('闇市：手札がないため交換できません');
      return;
    }

    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length === cardsToGiveCount) {
          return { valid: true };
        }
        return { valid: false, reason: `${cardsToGiveCount}枚選んでください` };
      }
    };

    const cardsToGive = await controller.chooseCardsInHand(
      validator,
      `闇市：${targetPlayer.name}に渡すカードを${cardsToGiveCount}枚選んでください`
    );

    if (cardsToGive.length !== cardsToGiveCount) {
      console.log('闇市：カード選択がキャンセルされました');
      return;
    }

    // 相手から最強2枚を取得
    const cardsToReceiveCount = Math.min(2, targetPlayer.hand.size());
    const cardsToReceive = this.getStrongestCards(targetPlayer, gameState, cardsToReceiveCount);

    // 交換実行
    player.hand.remove(cardsToGive);
    targetPlayer.hand.remove(cardsToReceive);

    player.hand.add(cardsToReceive);
    targetPlayer.hand.add(cardsToGive);

    console.log(`闇市：${player.name} が ${cardsToGive.map(c => `${c.rank}${c.suit}`).join(', ')} を渡し、${cardsToReceive.map(c => `${c.rank}${c.suit}`).join(', ')} を受け取りました`);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);
    targetPlayer.hand.sort(shouldReverse);

    // 相手の手札が空になったら上がり
    if (targetPlayer.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, targetPlayer);
    }
  }

  /**
   * 9賭け処理（非同期）
   * 9を出すと指名者がランダムで自分の手札を1枚捨てる
   */
  private async handleNineGamble(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('9賭け：コントローラーがないためスキップ');
      return;
    }

    // 自分以外のアクティブプレイヤーを取得
    const targetPlayers = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished && p.hand.size() > 0
    );

    if (targetPlayers.length === 0) {
      console.log('9賭け：対象プレイヤーがいません');
      return;
    }

    // プレイヤー選択
    const targetPlayer = await controller.choosePlayer(
      targetPlayers,
      '9賭け：手札を1枚捨てさせるプレイヤーを選んでください'
    );

    if (!targetPlayer || targetPlayer.isFinished) {
      console.log('9賭け：対象プレイヤーが見つかりません');
      return;
    }

    // 対象プレイヤーの手札からランダムで1枚選択
    const targetHand = targetPlayer.hand.getCards();
    if (targetHand.length === 0) {
      console.log('9賭け：対象プレイヤーの手札がありません');
      return;
    }

    const randomIndex = Math.floor(Math.random() * targetHand.length);
    const cardToDiscard = targetHand[randomIndex];

    // カードを捨てる
    targetPlayer.hand.remove([cardToDiscard]);
    gameState.discardPile.push(cardToDiscard);

    console.log(`9賭け：${targetPlayer.name} が ${cardToDiscard.rank}${cardToDiscard.suit} を捨てました`);

    // 手札が空になったら上がり
    if (targetPlayer.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, targetPlayer);
    }
  }

  /**
   * 9シャッフル処理（非同期）
   * 9x2で対戦相手の席順を自由に変更
   */
  private async handleNineShuffle(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('9シャッフル：コントローラーがないためスキップ');
      return;
    }

    // 自分以外のアクティブプレイヤーを取得
    const otherPlayers = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished
    );

    if (otherPlayers.length < 2) {
      console.log('9シャッフル：対象プレイヤーが2人未満のためスキップ');
      return;
    }

    // 現在のプレイヤーの位置を記録
    const currentPlayerIndex = gameState.players.findIndex(p => p.id.value === player.id.value);

    // プレイヤーに新しい席順を選択させる
    const newOrder = await controller.choosePlayerOrder(
      otherPlayers,
      '9シャッフル：対戦相手の新しい席順を選んでください'
    );

    if (!newOrder || newOrder.length !== otherPlayers.length) {
      console.log('9シャッフル：席順の選択がキャンセルされました');
      return;
    }

    // 新しいプレイヤー配列を構築
    // 現在のプレイヤーは自分の位置を維持し、他のプレイヤーは新しい順序で配置
    const newPlayers: Player[] = [];
    let newOrderIndex = 0;

    for (let i = 0; i < gameState.players.length; i++) {
      if (i === currentPlayerIndex) {
        newPlayers.push(player);
      } else {
        // 新しい順序から次のプレイヤーを取得
        if (newOrderIndex < newOrder.length) {
          newPlayers.push(newOrder[newOrderIndex]);
          newOrderIndex++;
        }
      }
    }

    // プレイヤー配列を更新
    gameState.players = newPlayers;

    // currentPlayerIndexを再計算
    gameState.currentPlayerIndex = gameState.players.findIndex(p => p.id.value === player.id.value);

    console.log(`9シャッフル：席順が変更されました -> ${newPlayers.map(p => p.name).join(' -> ')}`);
  }

  /**
   * 6もらい処理（非同期）
   * 6を出すと指名者にカード宣言、持っていれば貰える
   */
  private async handleSixClaim(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 自分以外のアクティブなプレイヤーを取得
    const otherPlayers = gameState.players.filter(p => !p.isFinished && p.id.value !== player.id.value);

    if (otherPlayers.length === 0) {
      console.log('6もらい：対象プレイヤーがいません');
      return;
    }

    // プレイヤーを選択
    const targetPlayer = await controller.choosePlayer(otherPlayers, '6もらい：カードを要求するプレイヤーを選んでください');

    if (!targetPlayer) {
      console.log('6もらい：プレイヤー選択がキャンセルされました');
      return;
    }

    // カードのランクを選択
    const rank = await controller.chooseCardRank('6もらい：欲しいカードのランクを選んでください');

    console.log(`6もらい：${player.name} が ${targetPlayer.name} に ${rank} を要求`);

    // 対象プレイヤーが指定ランクのカードを持っているかチェック
    const targetCards = targetPlayer.hand.getCards().filter(c => c.rank === rank);

    if (targetCards.length > 0) {
      // 1枚貰う
      const cardToTake = targetCards[0];
      targetPlayer.hand.remove([cardToTake]);
      player.hand.add([cardToTake]);

      console.log(`6もらい：${player.name} が ${targetPlayer.name} から ${cardToTake.rank}${cardToTake.suit} を貰いました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
      targetPlayer.hand.sort(shouldReverse);

      // 対象プレイヤーの手札が空になったら上がり
      if (targetPlayer.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, targetPlayer);
      }
    } else {
      console.log(`6もらい：${targetPlayer.name} は ${rank} を持っていません`);
    }
  }

  /**
   * 9もらい処理（非同期）
   * 9を出すと指名者に欲しいカードを宣言、持っていれば貰う
   * 6もらいと同じロジック
   */
  private async handleNineClaim(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) throw new Error('Controller not found');

    // 自分以外のアクティブなプレイヤーを取得
    const otherPlayers = gameState.players.filter(p => !p.isFinished && p.id.value !== player.id.value);

    if (otherPlayers.length === 0) {
      console.log('9もらい：対象プレイヤーがいません');
      return;
    }

    // プレイヤーを選択
    const targetPlayer = await controller.choosePlayer(otherPlayers, '9もらい：カードを要求するプレイヤーを選んでください');

    if (!targetPlayer) {
      console.log('9もらい：プレイヤー選択がキャンセルされました');
      return;
    }

    // カードのランクを選択
    const rank = await controller.chooseCardRank('9もらい：欲しいカードのランクを選んでください');

    console.log(`9もらい：${player.name} が ${targetPlayer.name} に ${rank} を要求`);

    // 対象プレイヤーが指定ランクのカードを持っているかチェック
    const targetCards = targetPlayer.hand.getCards().filter(c => c.rank === rank);

    if (targetCards.length > 0) {
      // 1枚貰う
      const cardToTake = targetCards[0];
      targetPlayer.hand.remove([cardToTake]);
      player.hand.add([cardToTake]);

      console.log(`9もらい：${player.name} が ${targetPlayer.name} から ${cardToTake.rank}${cardToTake.suit} を貰いました`);

      // ソート
      const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
      player.hand.sort(shouldReverse);
      targetPlayer.hand.sort(shouldReverse);

      // 対象プレイヤーの手札が空になったら上がり
      if (targetPlayer.hand.isEmpty()) {
        this.handlePlayerFinish(gameState, targetPlayer);
      }
    } else {
      console.log(`9もらい：${targetPlayer.name} は ${rank} を持っていません`);
    }
  }

  /**
   * 終焉のカウントダウン処理（非同期）
   * 大貧民が4x1を出すとカウントダウン開始、プレイヤーにカウント値を選ばせる（10-50）
   * パスするごとにカウントが1減少、0でパスした人が敗北
   */
  private async handleEndCountdown(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('終焉のカウントダウン：コントローラーがないためスキップ');
      return;
    }

    // カウント値を選ばせる（10-50）
    const countdownValue = await controller.chooseCountdownValue(10, 50);

    gameState.endCountdownValue = countdownValue;
    console.log(`終焉のカウントダウンが発動！カウント: ${countdownValue}`);
  }

  /**
   * テレフォース処理
   * 4x1を出すと7ターン後に全員敗北、残り手札で順位決定
   */
  private async handleTeleforce(gameState: GameState): Promise<void> {
    gameState.teleforceCountdown = 7;
    console.log('テレフォースが発動！7ターン後に全員敗北');
  }

  /**
   * テレフォースによるゲーム終了処理
   * 全員敗北、残り手札枚数で順位決定（手札が少ない方が上位）
   */
  private handleTeleforceGameEnd(gameState: GameState): void {
    gameState.teleforceCountdown = null;

    // まだ終了していないプレイヤーを手札枚数でソート（少ない順）
    const activePlayers = gameState.players.filter(p => !p.isFinished);
    const sortedPlayers = [...activePlayers].sort((a, b) => a.hand.size() - b.hand.size());

    // 順位を割り当て
    const finishedCount = gameState.players.filter(p => p.isFinished).length;
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      player.isFinished = true;
      player.finishPosition = finishedCount + i + 1;
      console.log(`テレフォース終了：${player.name} は ${player.finishPosition}位（手札${player.hand.size()}枚）`);
      this.rankAssignmentService.assignRank(gameState, player);
    }
  }

  /**
   * Aじゃないか処理
   * Ax4を出すとゲーム終了、全員平民に
   */
  private handleAceJanaiKa(gameState: GameState): void {
    console.log('Aじゃないかが発動！ゲーム終了、全員平民に');

    // 全員のランクを平民（HEIMIN）に設定
    for (const player of gameState.players) {
      player.rank = PlayerRank.HEIMIN;
      player.isFinished = true;
      // 順位は設定しない（全員平民なので順位の概念がない）
      player.finishPosition = null;
    }

    // ゲームフェーズをRESULTに変更（次のupdate時に終了処理される）
    gameState.phase = GamePhaseType.RESULT;
  }

  /**
   * 十字軍処理
   * 10x4で革命＋ジョーカー保持者から全ジョーカーを奪う
   */
  private async handleCrusade(gameState: GameState, player: Player): Promise<void> {
    console.log(`十字軍発動！${player.name} が全員からジョーカーを奪います`);

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    for (const targetPlayer of gameState.players) {
      // 自分と上がったプレイヤーはスキップ
      if (targetPlayer.id.value === player.id.value || targetPlayer.isFinished) continue;

      // ジョーカーを全て奪う
      const jokers = targetPlayer.hand.getCards().filter(c => c.rank === 'JOKER');
      if (jokers.length > 0) {
        targetPlayer.hand.remove(jokers);
        player.hand.add(jokers);
        console.log(`十字軍：${player.name} が ${targetPlayer.name} から ${jokers.length}枚のジョーカーを奪いました`);

        if (targetPlayer.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, targetPlayer);
        }
      }
    }

    // ソート
    player.hand.sort(shouldReverse);
  }

  /**
   * オークション処理
   * 10x3でジョーカー所持者から1枚ジョーカーを奪う
   */
  private async handleAuction(gameState: GameState, player: Player): Promise<void> {
    console.log(`オークション発動！${player.name} がジョーカー所持者から1枚奪います`);

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;

    // ジョーカーを持っているプレイヤーを探す
    for (const targetPlayer of gameState.players) {
      // 自分と上がったプレイヤーはスキップ
      if (targetPlayer.id.value === player.id.value || targetPlayer.isFinished) continue;

      // ジョーカーを1枚奪う
      const jokers = targetPlayer.hand.getCards().filter(c => c.rank === 'JOKER');
      if (jokers.length > 0) {
        const jokerToSteal = [jokers[0]];
        targetPlayer.hand.remove(jokerToSteal);
        player.hand.add(jokerToSteal);
        console.log(`オークション：${player.name} が ${targetPlayer.name} からジョーカーを1枚奪いました`);

        if (targetPlayer.hand.isEmpty()) {
          this.handlePlayerFinish(gameState, targetPlayer);
        }

        // 1枚だけ奪うのでここで終了
        break;
      }
    }

    // ソート
    player.hand.sort(shouldReverse);
  }

  /**
   * 片縛りの発動判定と適用
   * 複数枚で一部スートが一致すると、そのスートを含む組み合わせのみ出せる
   */
  private checkAndApplyPartialLock(gameState: GameState, play: Play): void {
    // ルールがOFFなら何もしない
    if (!gameState.ruleSettings.partialLock) return;

    // 既に片縛りが発動している場合は何もしない
    if (gameState.partialLockSuits) return;

    // 場に履歴がなければ発動しない（最初の出し）
    const history = gameState.field.getHistory();
    if (history.length === 0) return;

    // 前回のプレイを取得
    const prevPlayHistory = history[history.length - 1];
    const prevCards = prevPlayHistory.play.cards;
    const currentCards = play.cards;

    // 複数枚でなければ発動しない
    if (prevCards.length < 2 || currentCards.length < 2) return;

    // 前回と今回のスートを収集（ジョーカー以外）
    const prevSuits = new Set(prevCards.filter(c => c.rank !== 'JOKER').map(c => c.suit));
    const currentSuits = new Set(currentCards.filter(c => c.rank !== 'JOKER').map(c => c.suit));

    // 共通するスートを見つける
    const commonSuits = [...prevSuits].filter(suit => currentSuits.has(suit));

    // 共通スートがあれば片縛り発動
    if (commonSuits.length > 0) {
      gameState.partialLockSuits = commonSuits;
      console.log(`片縛りが発動しました！（${commonSuits.join(', ')}）`);
    }
  }

  /**
   * 矢切の渡し処理（非同期）
   * 8を出すと8切り＋任意プレイヤーにカードを渡せる
   */
  private async handleYagiriNoWatashi(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) {
      console.log('矢切の渡し：コントローラーがないためスキップ');
      return;
    }

    // 手札がなければスキップ
    if (player.hand.isEmpty()) {
      console.log('矢切の渡し：手札がないためスキップ');
      return;
    }

    // 自分以外のアクティブプレイヤーを取得
    const targetPlayers = gameState.players.filter(
      p => p.id.value !== player.id.value && !p.isFinished
    );

    if (targetPlayers.length === 0) {
      console.log('矢切の渡し：対象プレイヤーがいないためスキップ');
      return;
    }

    console.log(`矢切の渡し：${player.name} が任意のプレイヤーにカードを渡せます`);

    // プレイヤーを選択
    const targetPlayer = await controller.choosePlayer(
      targetPlayers,
      '矢切の渡し：カードを渡すプレイヤーを選んでください'
    );

    if (!targetPlayer) {
      console.log('矢切の渡し：プレイヤー選択がキャンセルされました');
      return;
    }

    // 渡すカードを選択（1枚）
    const validator: Validator = {
      validate: (cards: Card[]) => {
        if (cards.length === 1) {
          return { valid: true };
        }
        return { valid: false, reason: '1枚選んでください' };
      }
    };

    const cardsToPass = await controller.chooseCardsInHand(
      validator,
      `矢切の渡し：${targetPlayer.name}に渡すカードを1枚選んでください`
    );

    if (cardsToPass.length !== 1) {
      console.log('矢切の渡し：カード選択がキャンセルされました');
      return;
    }

    const card = cardsToPass[0];

    // カードを渡す
    player.hand.remove([card]);
    targetPlayer.hand.add([card]);
    console.log(`矢切の渡し：${player.name} が ${targetPlayer.name} に ${card.rank}${card.suit} を渡しました`);

    // ソート
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    targetPlayer.hand.sort(shouldReverse);

    // 自分の手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
    }
  }

  /**
   * 物資救援処理
   * 大貧民のターン1回限りで、場のカード全てを手札に加え親になる
   */
  private async handleSupplyAid(gameState: GameState, player: Player): Promise<void> {
    // 場のカードを全て手札に加える
    const history = gameState.field.getHistory();
    for (const playHistory of history) {
      player.hand.add(playHistory.play.cards);
    }
    console.log(`${player.name} が物資救援で場のカードを全て回収しました！`);

    // 場をクリア（捨て札には行かない）
    gameState.field.clear();
    gameState.passCount = 0;
    gameState.isEightCutPending = false;
    gameState.suitLock = null;
    gameState.numberLock = false;
    gameState.colorLock = null;
    gameState.isTwoBack = false;
    gameState.isDamianActive = false;
    gameState.parityRestriction = null;
    gameState.isTenFreeActive = false;
    gameState.isDoubleDigitSealActive = false;
    gameState.hotMilkRestriction = null;
    gameState.isArthurActive = false;
    gameState.partialLockSuits = null;

    // 親になる（currentPlayerIndexはそのまま）
    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    player.hand.sort(shouldReverse);

    // 使用済みフラグを設定
    gameState.supplyAidUsed = true;
  }

  /**
   * 拾い食い処理
   * 大富豪がカード出した時1回限りで、大富豪の捨てカードを拾える（大富豪はパス扱い）
   */
  private async handleScavenging(gameState: GameState, daihinminPlayer: Player): Promise<void> {
    // 直前のプレイ（大富豪が出したカード）を取得
    const lastPlay = gameState.field.getLastPlay();
    if (!lastPlay) return;

    // 直前のカードを手札に加える
    daihinminPlayer.hand.add(lastPlay.play.cards);
    console.log(`${daihinminPlayer.name} が拾い食いで${lastPlay.play.cards.map(c => `${c.rank}${c.suit}`).join(', ')}を拾いました！`);

    // 場から直前のプレイを削除
    gameState.field.removeLastPlay();

    const shouldReverse = gameState.isRevolution !== gameState.isElevenBack;
    daihinminPlayer.hand.sort(shouldReverse);

    // 使用済みフラグを設定
    gameState.scavengingUsed = true;
  }

  /**
   * カルテル処理
   * 大貧民が3-4-5の階段を出すと大富豪以外は手札を見せ合える
   */
  private handleCartel(gameState: GameState, _player: Player): void {
    console.log('カルテル発動！大富豪以外のプレイヤーの手札を表示します：');
    for (const p of gameState.players) {
      if (p.rank !== PlayerRank.DAIFUGO && !p.isFinished) {
        const cards = p.hand.getCards();
        console.log(`  ${p.name}: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);
      }
    }
  }

  /**
   * ギロチン時計設定処理
   * 大貧民が開始時に設定、n回目のパスで敗北確定（10<=n<=50）
   */
  private async handleGuillotineClock(gameState: GameState, player: Player): Promise<void> {
    const controller = this.playerControllers.get(player.id.value);
    if (!controller) return;

    // プレイヤーに回数を選択させる（簡易実装: 10〜50の範囲でランダム）
    // 実際のUI実装では、プレイヤーに数値入力を求める
    const count = Math.floor(Math.random() * 41) + 10; // 10〜50
    gameState.guillotineClockCount = count;
    console.log(`${player.name} がギロチン時計を設定しました：${count}回パスで敗北`);
  }

  /**
   * どかん条件判定（場のカード合計 = 手札合計）
   * カードの合計値を計算し、場と手札が一致するかを判定
   * - 数字カード: そのままの数値（3〜10）
   * - J: 11, Q: 12, K: 13, A: 14（または1）
   * - 2: 15（または2）
   * - JOKER: 0（計算から除外するか、任意の値とするか要検討）
   *
   * 注意: このルールの仕様が曖昧なため、シンプルに以下の定義を採用:
   * - 数字カード 3〜10 はその数値
   * - J=11, Q=12, K=13, A=14, 2=15
   * - JOKER=0
   */
  private checkDokanCondition(gameState: GameState, player: Player): boolean {
    // 場にカードがなければ発動しない
    if (gameState.field.isEmpty()) return false;

    // 場のカード合計を計算
    const fieldHistory = gameState.field.getHistory();
    let fieldSum = 0;
    for (const history of fieldHistory) {
      for (const card of history.play.cards) {
        fieldSum += this.getCardValue(card);
      }
    }

    // 手札合計を計算
    const handCards = player.hand.getCards();
    let handSum = 0;
    for (const card of handCards) {
      handSum += this.getCardValue(card);
    }

    console.log(`どかん判定: 場の合計=${fieldSum}, 手札の合計=${handSum}`);
    return fieldSum === handSum && handSum > 0;
  }

  /**
   * カードの数値を取得（どかん用）
   */
  private getCardValue(card: Card): number {
    switch (card.rank) {
      case '3': return 3;
      case '4': return 4;
      case '5': return 5;
      case '6': return 6;
      case '7': return 7;
      case '8': return 8;
      case '9': return 9;
      case '10': return 10;
      case 'J': return 11;
      case 'Q': return 12;
      case 'K': return 13;
      case 'A': return 14;
      case '2': return 15;
      case 'JOKER': return 0;
      default: return 0;
    }
  }

  /**
   * ババ落ち処理
   * ジョーカー含む5枚で革命を起こすと、もう1枚のジョーカーを持っているプレイヤーは敗北
   */
  private async handleBabaOchi(gameState: GameState, player: Player): Promise<void> {
    console.log(`ババ落ち発動！${player.name} がジョーカー含む5枚革命を発動しました`);

    // ジョーカーを持っている他のプレイヤーを探す
    for (const targetPlayer of gameState.players) {
      // 自分と既に上がったプレイヤーはスキップ
      if (targetPlayer.id.value === player.id.value || targetPlayer.isFinished) continue;

      // ジョーカーを持っているか確認
      const jokers = targetPlayer.hand.getCards().filter(c => c.rank === 'JOKER');
      if (jokers.length > 0) {
        console.log(`ババ落ち：${targetPlayer.name} はジョーカーを持っているため敗北！`);

        // プレイヤーを敗北扱いにする（最下位）
        targetPlayer.isFinished = true;
        targetPlayer.finishPosition = gameState.players.filter(p => p.isFinished).length;

        // ランクを大貧民に設定
        targetPlayer.rank = PlayerRank.DAIHINMIN;

        break; // 1人だけ敗北させる（もう1枚のジョーカーは1枚しかないはず）
      }
    }
  }

  // ==================================================
  // カード操作系ルール
  // ==================================================

  /**
   * ゲリラ兵処理
   * 場のカードと同数字をより多く持つ時、手札から捨て札に直接送れる（手札圧縮）
   * @param player カードを出したプレイヤー
   * @param fieldRank 場のカードのランク
   * @returns 捨て札に送ったカード
   */
  async handleGuerrilla(gameState: GameState, player: Player, fieldRank: string): Promise<Card[]> {
    if (!gameState.ruleSettings.guerrilla) return [];

    // 場のカードと同じランクのカードを手札から取得
    const matchingCards = player.hand.getCards().filter(c => c.rank === fieldRank);

    // 場のカードの枚数（現在の場のプレイ）
    const currentPlay = gameState.field.getCurrentPlay();
    if (!currentPlay) return [];

    const fieldCardCount = currentPlay.cards.length;

    // より多く持っている場合のみ発動
    if (matchingCards.length <= fieldCardCount) return [];

    // プレイヤーにどのカードを捨てるか選択させる（簡易実装：自動で全て捨てる）
    console.log(`ゲリラ兵発動！${player.name} は ${fieldRank} を ${matchingCards.length} 枚持っています（場は ${fieldCardCount} 枚）`);

    // 手札から削除して捨て札に送る
    player.hand.remove(matchingCards);
    gameState.discardPile.push(...matchingCards);

    console.log(`  ${matchingCards.map(c => `${c.rank}${c.suit}`).join(', ')} を捨て札に送りました`);

    return matchingCards;
  }

  /**
   * カタパルト処理
   * 場のカードと同数字を追加で出し、4枚以上になったら革命発動
   * @param player カードを出したプレイヤー
   * @param fieldRank 場のカードのランク
   * @returns 追加で出したカード
   */
  async handleCatapult(gameState: GameState, player: Player, fieldRank: string): Promise<Card[]> {
    if (!gameState.ruleSettings.catapult) return [];

    // 場のカードと同じランクのカードを手札から取得
    const matchingCards = player.hand.getCards().filter(c => c.rank === fieldRank);
    if (matchingCards.length === 0) return [];

    // プレイヤーにどのカードを追加するか選択させる（簡易実装：自動で全て追加）
    console.log(`カタパルト発動！${player.name} は ${fieldRank} を ${matchingCards.length} 枚追加できます`);

    // 手札から削除して場のカードに追加
    player.hand.remove(matchingCards);

    // 場のカードの枚数を計算
    const currentPlay = gameState.field.getCurrentPlay();
    if (!currentPlay) return [];

    const totalCards = currentPlay.cards.length + matchingCards.length;

    console.log(`  ${matchingCards.map(c => `${c.rank}${c.suit}`).join(', ')} を追加（合計 ${totalCards} 枚）`);

    // 4枚以上で革命発動
    if (totalCards >= 4) {
      console.log('カタパルト革命！4枚以上になったため革命発動！');
      gameState.isRevolution = !gameState.isRevolution;
      gameState.revolutionCount++;
      await this.presentationRequester.requestCutIns([{ effect: 'カタパルト革命', variant: 'red' }]);
    }

    // 捨て札に送る（場には追加しない＝前プレイヤーのカード扱い）
    gameState.discardPile.push(...matchingCards);

    return matchingCards;
  }

  /**
   * スペード返し処理
   * 特殊効果発動時に同数字スペードで効果キャンセル
   * @param triggeredEffect キャンセル対象のエフェクト
   * @param fieldRank 場のカードのランク
   * @returns キャンセルに使ったカード
   */
  async checkSpadeCounter(gameState: GameState, triggeredEffect: TriggerEffect, fieldRank: string): Promise<Card | null> {
    if (!gameState.ruleSettings.spadeCounter) return null;

    // キャンセル可能なエフェクトのリスト
    const cancellableEffects: TriggerEffect[] = [
      '8切り', '革命', '階段革命', 'イレブンバック', '5スキップ', '10飛び', '7渡し',
      '10捨て', 'クイーンボンバー', '9リバース', 'Qリバース', 'Kリバース'
    ];

    if (!cancellableEffects.includes(triggeredEffect)) return null;

    // すべてのプレイヤー（現在のプレイヤーを除く）で同数字スペードを持っているか確認
    for (const player of gameState.players) {
      if (player.isFinished) continue;

      const spadeCard = player.hand.getCards().find(
        c => c.suit === Suit.SPADE && c.rank === fieldRank
      );

      if (spadeCard) {
        console.log(`スペード返し発動！${player.name} が ♠${fieldRank} で ${triggeredEffect} をキャンセル！`);

        // 手札から削除して捨て札に送る
        player.hand.remove([spadeCard]);
        gameState.discardPile.push(spadeCard);

        await this.presentationRequester.requestCutIns([{ effect: 'スペード返し', variant: 'blue' }]);

        return spadeCard;
      }
    }

    return null;
  }

  /**
   * バナナアイス判定
   * 同色6枚の階段は直接捨て札に送れる
   * @param cards チェックするカード
   * @returns バナナアイス条件を満たすかどうか
   */
  isBananaIce(cards: Card[]): boolean {
    if (cards.length !== 6) return false;

    // すべて同じ色か確認
    const firstCard = cards.find(c => c.rank !== 'JOKER');
    if (!firstCard) return false;

    const firstColor = this.getSuitColor(firstCard.suit);
    if (!firstColor) return false;

    const allSameColor = cards.every(c => {
      if (c.rank === 'JOKER') return true;
      return this.getSuitColor(c.suit) === firstColor;
    });

    if (!allSameColor) return false;

    // 階段（連番）になっているか確認
    const sortedCards = [...cards]
      .filter(c => c.rank !== 'JOKER')
      .sort((a, b) => a.strength - b.strength);

    const jokerCount = cards.filter(c => c.rank === 'JOKER').length;

    // 連番チェック（ジョーカーで補完可能）
    let gaps = 0;
    for (let i = 1; i < sortedCards.length; i++) {
      const diff = sortedCards[i].strength - sortedCards[i - 1].strength;
      if (diff === 1) continue;
      if (diff > 1) gaps += diff - 1;
    }

    return gaps <= jokerCount;
  }

  /**
   * バナナアイス処理
   * 同色6枚の階段を直接捨て札に送る
   * @param player カードを出したプレイヤー
   * @param cards バナナアイスのカード
   */
  async handleBananaIce(gameState: GameState, player: Player, cards: Card[]): Promise<void> {
    if (!gameState.ruleSettings.bananaIce) return;

    if (!this.isBananaIce(cards)) return;

    console.log(`バナナアイス発動！${player.name} が同色6枚の階段を宣言！`);

    // 手札から削除して捨て札に送る
    player.hand.remove(cards);
    gameState.discardPile.push(...cards);

    console.log(`  ${cards.map(c => `${c.rank}${c.suit}`).join(', ')} を捨て札に送りました`);

    await this.presentationRequester.requestCutIns([{ effect: 'バナナアイス', variant: 'yellow' }]);
  }

  /**
   * スートから色を取得（バナナアイス用）
   */
  private getSuitColor(suit: Suit): 'red' | 'black' | null {
    if (suit === Suit.HEART || suit === Suit.DIAMOND) return 'red';
    if (suit === Suit.SPADE || suit === Suit.CLUB) return 'black';
    return null;
  }
}
