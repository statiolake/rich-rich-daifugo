import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { Card, Suit } from '../domain/card/Card';
import { PlayAnalyzer, Play, PlayType } from '../domain/card/Play';
import { Player, PlayerType } from '../domain/player/Player';
import { PlayerRank } from '../domain/player/PlayerRank';
import { RuleEngine } from '../rules/base/RuleEngine';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';

export class PlayPhase implements GamePhase {
  readonly type = GamePhaseType.PLAY;
  private waitForCutInFn?: () => Promise<void>;

  constructor(
    private strategyMap: Map<string, PlayerStrategy>,
    private ruleEngine: RuleEngine,
    private eventBus?: GameEventEmitter
  ) {}

  setWaitForCutIn(fn: () => Promise<void>): void {
    this.waitForCutInFn = fn;
  }

  async enter(gameState: GameState): Promise<void> {
    gameState.field.clear();
    gameState.passCount = 0;
    gameState.isElevenBack = false; // 新しいラウンド開始時に11バックをリセット
    gameState.isEightCutPending = false; // 8切りフラグをリセット
    gameState.suitLock = null; // 縛りをリセット
    gameState.numberLock = false; // 数字しばりをリセット
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
    const nextPhase = this.checkGameEnd(gameState);
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

    // ラッキーセブンのリセット（新しいカードが出されたら、それがラッキーセブンでない限りリセット）
    if (gameState.luckySeven && !this.triggersLuckySeven(play)) {
      console.log('ラッキーセブンが破られました');
      gameState.luckySeven = null;
    }

    // マークしばりチェック（ルール有効時のみ）
    if (gameState.ruleSettings.suitLock) {
      const history = gameState.field.getHistory();
      if (history.length >= 2) {
        const prevPlayHistory = history[history.length - 2];
        const currentPlayHistory = history[history.length - 1];

        // 両方のプレイがすべて同じマークか確認
        const prevSuit = prevPlayHistory.play.cards.length > 0 ? prevPlayHistory.play.cards[0].suit : null;
        const currentSuit = currentPlayHistory.play.cards.length > 0 ? currentPlayHistory.play.cards[0].suit : null;

        const prevAllSameSuit = prevPlayHistory.play.cards.every(c => c.suit === prevSuit);
        const currentAllSameSuit = currentPlayHistory.play.cards.every(c => c.suit === currentSuit);

        // 連続で同じマークが出されたら縛り発動
        if (prevAllSameSuit && currentAllSameSuit && prevSuit === currentSuit && prevSuit && !gameState.suitLock) {
          gameState.suitLock = prevSuit;
          console.log(`マークしばりが発動しました！（${prevSuit}）`);

          // イベント発火
          this.eventBus?.emit('suitLock:triggered', { suit: prevSuit });
        }
      }
    }

    // 数字しばりチェック（ルール有効時のみ）
    if (gameState.ruleSettings.numberLock) {
      const history = gameState.field.getHistory();
      if (history.length >= 2) {
        const prevPlayHistory = history[history.length - 2];
        const currentPlayHistory = history[history.length - 1];

        // 両方のプレイが階段か確認
        const prevIsStair = prevPlayHistory.play.type === PlayType.STAIR;
        const currentIsStair = currentPlayHistory.play.type === PlayType.STAIR;

        // 連続で階段が出されたら数字しばり発動
        if (prevIsStair && currentIsStair && !gameState.numberLock) {
          gameState.numberLock = true;
          console.log('数字しばりが発動しました！');

          // イベント発火
          this.eventBus?.emit('numberLock:triggered', {});
        }
      }
    }

    // ルール発動フラグ
    let triggeredRules = false;

    // 砂嵐判定（3x3が何にでも勝つ）
    if (gameState.ruleSettings.sandstorm && this.triggersSandstorm(play)) {
      console.log('砂嵐が発動しました！');

      // イベント発火
      this.eventBus?.emit('sandstorm:triggered', {});

      triggeredRules = true;
    }

    // スペ3返し判定（スペード3でジョーカーを返す）
    if (gameState.ruleSettings.spadeThreeReturn && this.triggersSpadeThreeReturn(play, gameState)) {
      console.log('スペ3返しが発動しました！');

      // イベント発火
      this.eventBus?.emit('spadeThreeReturn:triggered', {});

      triggeredRules = true;
    }

    // ダウンナンバー判定（同じスートで1小さい数字で返せる）
    if (gameState.ruleSettings.downNumber && this.triggersDownNumber(play, gameState)) {
      console.log('ダウンナンバーが発動しました！');

      // イベント発火
      this.eventBus?.emit('downNumber:triggered', {});

      triggeredRules = true;
    }

    // ラッキーセブン判定（7x3を出す）
    if (gameState.ruleSettings.luckySeven && this.triggersLuckySeven(play)) {
      console.log('ラッキーセブンが発動しました！');
      gameState.luckySeven = { playerId: player.id.value };

      // イベント発火
      this.eventBus?.emit('luckySeven:triggered', {
        playerName: player.name
      });

      triggeredRules = true;
    }

    // 4止め判定（8切りを止める）
    if (gameState.ruleSettings.fourStop && this.triggersFourStop(play) && gameState.isEightCutPending) {
      console.log('4止めが発動しました！8切りを止めます');
      gameState.isEightCutPending = false;

      // イベント発火
      this.eventBus?.emit('fourStop:triggered', {});

      triggeredRules = true;
    }

    // 8切り判定（場をクリアする）
    if (gameState.ruleSettings.eightCut && this.triggersEightCut(play)) {
      console.log('8切りが発動しました！');
      gameState.isEightCutPending = true;

      // イベント発火
      this.eventBus?.emit('eightCut:triggered', {});

      triggeredRules = true;
    }

    // 救急車判定（9x2で場をクリア）
    if (gameState.ruleSettings.ambulance && this.triggersAmbulance(play)) {
      console.log('救急車が発動しました！');

      // イベント発火
      this.eventBus?.emit('ambulance:triggered', {});

      triggeredRules = true;
    }

    // ろくろ首判定（6x2で場をクリア）
    if (gameState.ruleSettings.rokurokubi && this.triggersRokurokubi(play)) {
      console.log('ろくろ首が発動しました！');

      // イベント発火
      this.eventBus?.emit('rokurokubi:triggered', {});

      triggeredRules = true;
    }

    // 11バック判定（イベント発火のみ、awaitしない）
    if (this.triggersElevenBack(play)) {
      gameState.isElevenBack = !gameState.isElevenBack;
      console.log(`11バックが発動しました！ isElevenBack: ${gameState.isElevenBack}`);

      // イベント発火
      this.eventBus?.emit('elevenBack:triggered', {
        isElevenBack: gameState.isElevenBack
      });

      triggeredRules = true;
    }

    // エンペラー判定（4種マーク連番で革命）
    if (gameState.ruleSettings.emperor && this.triggersEmperor(play)) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`エンペラーが発動しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('emperor:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // クーデター判定（9x3で革命）
    if (gameState.ruleSettings.coup && this.triggersCoup(play)) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`クーデターが発動しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('coup:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // オーメン判定（6x3で革命 + 以後革命なし）
    if (gameState.ruleSettings.omen && this.triggersOmen(play) && !gameState.isOmenActive) {
      gameState.isRevolution = !gameState.isRevolution;
      gameState.isOmenActive = true;
      console.log(`オーメンが発動しました！ isRevolution: ${gameState.isRevolution}, 以後革命なし`);

      // イベント発火
      this.eventBus?.emit('omen:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // 大革命判定（2x4で革命 + 即勝利）
    if (gameState.ruleSettings.greatRevolution && this.triggersGreatRevolution(play) && !gameState.isOmenActive) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`大革命が発動しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('greatRevolution:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;

      // 即勝利処理は後で handlePlayerFinish を呼ぶ前にチェック
    }

    // 革命判定（イベント発火のみ、awaitしない）
    // オーメンが有効な場合は革命が発動しない
    if (play.triggersRevolution && !gameState.isOmenActive) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`革命が発生しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('revolution:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // 全イベント発火後に1回だけ待機
    if (triggeredRules && this.waitForCutInFn) {
      console.log('[PlayPhase] Waiting for cut-in animations...');
      await this.waitForCutInFn();
      console.log('[PlayPhase] Cut-in animations completed, resuming game...');
    }

    // カットイン完了後にソート（XORロジック反映）
    if (triggeredRules) {
      gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
    }

    // 8切り・救急車・ろくろ首の場合、場をクリア
    // 8切りは、4止めで止められた場合は発動しない
    const shouldClearField =
      (gameState.ruleSettings.eightCut && this.triggersEightCut(play) && gameState.isEightCutPending) ||
      (gameState.ruleSettings.ambulance && this.triggersAmbulance(play)) ||
      (gameState.ruleSettings.rokurokubi && this.triggersRokurokubi(play));

    if (shouldClearField) {
      // ラッキーセブン勝利チェック（8切り等で流れた場合）
      if (gameState.luckySeven) {
        const luckyPlayer = gameState.players.find(p => p.id.value === gameState.luckySeven!.playerId);
        if (luckyPlayer && !luckyPlayer.isFinished) {
          console.log(`${luckyPlayer.name} がラッキーセブンで勝利しました！`);
          // 全ての手札を削除して即座に上がり
          const remainingCards = luckyPlayer.hand.getCards();
          if (remainingCards.length > 0) {
            luckyPlayer.hand.remove([...remainingCards]);
          }
          this.handlePlayerFinish(gameState, luckyPlayer);

          // イベント発火
          this.eventBus?.emit('luckySeven:victory', {
            playerName: luckyPlayer.name
          });
        }
        gameState.luckySeven = null;
      }

      gameState.field.clear();
      gameState.passCount = 0;
      gameState.isEightCutPending = false; // 場をクリアしたら8切りフラグもリセット
      gameState.suitLock = null; // 場をクリアしたら縛りもリセット
      gameState.numberLock = false; // 場をクリアしたら数字しばりもリセット

      // 11バックをリセット
      if (gameState.isElevenBack) {
        gameState.isElevenBack = false;
        console.log('11バックがリセットされました');

        // 全プレイヤーの手札を再ソート
        gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
      }

      console.log('場が流れました');
    }

    // 場をクリアした場合は、手番を維持する（nextPlayerを呼ばない）
    const shouldKeepTurn = shouldClearField;

    // 大革命の即勝利処理
    if (gameState.ruleSettings.greatRevolution && this.triggersGreatRevolution(play)) {
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
    if (gameState.ruleSettings.sevenPass && this.triggersSevenPass(play) && !player.hand.isEmpty()) {
      await this.handleSevenPass(gameState, player);
    }

    // 10捨て判定（手札から1枚を捨てる）
    if (gameState.ruleSettings.tenDiscard && this.triggersTenDiscard(play) && !player.hand.isEmpty()) {
      await this.handleTenDiscard(gameState, player);
    }

    // クイーンボンバー判定（全員が指定されたカードを捨てる）
    if (gameState.ruleSettings.queenBomber && this.triggersQueenBomber(play)) {
      await this.handleQueenBomber(gameState, player);
    }

    // 9リバース判定
    if (gameState.ruleSettings.nineReverse && this.triggersNineReverse(play)) {
      gameState.isReversed = !gameState.isReversed;
      console.log(`9リバースが発動しました！ isReversed: ${gameState.isReversed}`);
      // イベント発火
      this.eventBus?.emit('nineReverse:triggered', {
        isReversed: gameState.isReversed
      });
    }

    // 5スキップ判定
    const shouldSkipNext = gameState.ruleSettings.fiveSkip && this.triggersFiveSkip(play);
    if (shouldSkipNext) {
      console.log('5スキップが発動しました！');
      // イベント発火
      this.eventBus?.emit('fiveSkip:triggered', {});
    }

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
      // 全員がパスした後、誰も出せない場合はゲーム終了
      if (!this.canAnyonePlay(gameState)) {
        console.log('全員が出せる手がないため、ゲームを終了します');
        this.endGameDueToNoPlays(gameState);
        return;
      }

      console.log('場が流れました');

      // ラッキーセブン勝利チェック
      if (gameState.luckySeven) {
        const luckyPlayer = gameState.players.find(p => p.id.value === gameState.luckySeven!.playerId);
        if (luckyPlayer && !luckyPlayer.isFinished) {
          console.log(`${luckyPlayer.name} がラッキーセブンで勝利しました！`);
          // 全ての手札を削除して即座に上がり
          const remainingCards = luckyPlayer.hand.getCards();
          if (remainingCards.length > 0) {
            luckyPlayer.hand.remove([...remainingCards]);
          }
          this.handlePlayerFinish(gameState, luckyPlayer);

          // イベント発火
          this.eventBus?.emit('luckySeven:victory', {
            playerName: luckyPlayer.name
          });
        }
        gameState.luckySeven = null;
      }

      gameState.field.clear();
      gameState.passCount = 0;
      gameState.isEightCutPending = false; // 場が流れたら8切りフラグもリセット
      gameState.suitLock = null; // 場が流れたら縛りもリセット
      gameState.numberLock = false; // 場が流れたら数字しばりもリセット

      // 11バックをリセット
      if (gameState.isElevenBack) {
        gameState.isElevenBack = false;
        console.log('11バックがリセットされました');

        // 全プレイヤーの手札を再ソート
        gameState.players.forEach(p => p.hand.sort(gameState.isRevolution !== gameState.isElevenBack));
      }
    }

    this.nextPlayer(gameState);
  }

  private handlePlayerFinish(gameState: GameState, player: Player): void {
    const finishedCount = gameState.players.filter(p => p.isFinished).length;
    player.isFinished = true;
    player.finishPosition = finishedCount + 1;

    console.log(`${player.name} finished in position ${player.finishPosition}`);

    // ランクを割り当て
    this.assignRank(gameState, player);
  }

  private assignRank(gameState: GameState, player: Player): void {
    const totalPlayers = gameState.players.length;
    const position = player.finishPosition!;

    if (totalPlayers === 4) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.FUGO;
      else if (position === 3) player.rank = PlayerRank.HINMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else if (totalPlayers === 5) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.FUGO;
      else if (position === 3) player.rank = PlayerRank.HEIMIN;
      else if (position === 4) player.rank = PlayerRank.HINMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else if (totalPlayers === 3) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.HEIMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else {
      // その他の人数の場合は平民
      player.rank = PlayerRank.HEIMIN;
    }
  }

  private checkGameEnd(gameState: GameState): GamePhaseType | null {
    const remainingPlayers = gameState.players.filter(p => !p.isFinished).length;

    if (remainingPlayers <= 1) {
      // 最後のプレイヤーに最下位を割り当て
      const lastPlayer = gameState.players.find(p => !p.isFinished);
      if (lastPlayer) {
        this.handlePlayerFinish(gameState, lastPlayer);
      }

      return GamePhaseType.RESULT;
    }

    return null;
  }

  /**
   * 7渡しを処理する
   */
  private async handleSevenPass(gameState: GameState, player: Player): Promise<void> {
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
      // イベント発火とカットイン待機
      this.eventBus?.emit('sevenPass:triggered', {
        fromPlayer: player.name,
        toPlayer: nextPlayer.name
      });

      if (this.waitForCutInFn) {
        await this.waitForCutInFn();
      }

      // Validator: 任意のカード1枚
      const validator = (cards: Card[]) => {
        if (cards.length === 1) {
          return { valid: true };
        }
        return { valid: false, reason: '1枚選んでください' };
      };

      const strategy = this.strategyMap.get(player.id.value);
      if (!strategy) return;

      const selectedCards = await strategy.selectCards(player, validator, {
        message: `7渡し：${nextPlayer.name}に渡すカードを1枚選んでください`
      });

      if (selectedCards.length === 1) {
        player.hand.remove(selectedCards);
        nextPlayer.hand.add(selectedCards);
        console.log(`7渡し：${player.name}が${nextPlayer.name}に${selectedCards[0].rank}${selectedCards[0].suit}を渡しました`);
      }
    }
  }

  /**
   * 10捨てを処理する
   */
  private async handleTenDiscard(gameState: GameState, player: Player): Promise<void> {
    // イベント発火とカットイン待機
    this.eventBus?.emit('tenDiscard:triggered', {
      player: player.name
    });

    if (this.waitForCutInFn) {
      await this.waitForCutInFn();
    }

    // Validator: 任意のカード1枚
    const validator = (cards: Card[]) => {
      if (cards.length === 1) {
        return { valid: true };
      }
      return { valid: false, reason: '1枚選んでください' };
    };

    const strategy = this.strategyMap.get(player.id.value);
    if (!strategy) return;

    const selectedCards = await strategy.selectCards(player, validator, {
      message: '10捨て：捨てるカードを1枚選んでください'
    });

    if (selectedCards.length === 1) {
      player.hand.remove(selectedCards);
      console.log(`10捨て：${player.name}が${selectedCards[0].rank}${selectedCards[0].suit}を捨てました`);
    }
  }

  /**
   * クイーンボンバーを処理する
   */
  private async handleQueenBomber(gameState: GameState, player: Player): Promise<void> {
    console.log('クイーンボンバー発動！カードを選んでください');

    // イベント発火とカットイン待機
    this.eventBus?.emit('queenBomber:triggered', {});

    if (this.waitForCutInFn) {
      await this.waitForCutInFn();
    }

    // 発動プレイヤーがランクを選択
    const strategy = this.strategyMap.get(player.id.value);
    if (!strategy) return;

    const selectedRank = await strategy.selectRank(player);
    console.log(`クイーンボンバー：${selectedRank}が指定されました`);

    // 全プレイヤーが順番にカードを捨てる
    const startIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    for (let i = 0; i < gameState.players.length; i++) {
      const playerIndex = (startIndex + i) % gameState.players.length;
      const currentPlayer = gameState.players[playerIndex];

      if (currentPlayer.isFinished || currentPlayer.hand.isEmpty()) {
        continue;
      }

      const playerStrategy = this.strategyMap.get(currentPlayer.id.value);
      if (!playerStrategy) continue;

      // Validator: 指定ランクのカード1枚、またはスキップ（空配列）
      const validator = (cards: Card[]) => {
        if (cards.length === 0) {
          return { valid: true }; // スキップ
        }
        if (cards.length === 1 && cards[0].rank === selectedRank) {
          return { valid: true };
        }
        return { valid: false, reason: `${selectedRank}を1枚選んでください` };
      };

      const selectedCards = await playerStrategy.selectCards(currentPlayer, validator, {
        message: `クイーンボンバー：${selectedRank}を捨ててください`,
        specifiedRank: selectedRank
      });

      if (selectedCards.length > 0) {
        currentPlayer.hand.remove(selectedCards);
        console.log(`クイーンボンバー：${currentPlayer.name}が${selectedCards[0].rank}を捨てました`);
      } else {
        console.log(`クイーンボンバー：${currentPlayer.name}は${selectedRank}を持っていないのでスキップ`);
      }
    }
  }

  private triggersElevenBack(play: Play): boolean {
    // Jが含まれているかチェック
    return play.cards.some(card => card.rank === 'J');
  }

  private triggersEightCut(play: Play): boolean {
    // 8が含まれているかチェック
    return play.cards.some(card => card.rank === '8');
  }

  private triggersAmbulance(play: Play): boolean {
    // 9のペア（2枚）かチェック
    return play.type === PlayType.PAIR &&
           play.cards.every(card => card.rank === '9');
  }

  private triggersRokurokubi(play: Play): boolean {
    // 6のペア（2枚）かチェック
    return play.type === PlayType.PAIR &&
           play.cards.every(card => card.rank === '6');
  }

  private triggersEmperor(play: Play): boolean {
    // 4種類のマークの連番（階段）かチェック
    if (play.type !== PlayType.STAIR || play.cards.length !== 4) {
      return false;
    }

    // 4つの異なるマークがあるかチェック
    const suits = new Set(play.cards.map(card => card.suit));
    return suits.size === 4;
  }

  private triggersCoup(play: Play): boolean {
    // 9のスリーカード（3枚）かチェック
    return play.type === PlayType.TRIPLE &&
           play.cards.every(card => card.rank === '9');
  }

  private triggersGreatRevolution(play: Play): boolean {
    // 2のフォーカード（4枚）かチェック
    return play.type === PlayType.QUAD &&
           play.cards.every(card => card.rank === '2');
  }

  private triggersOmen(play: Play): boolean {
    // 6のスリーカード（3枚）かチェック
    return play.type === PlayType.TRIPLE &&
           play.cards.every(card => card.rank === '6');
  }

  private triggersFourStop(play: Play): boolean {
    // 4のペア（2枚）かチェック
    return play.type === PlayType.PAIR &&
           play.cards.every(card => card.rank === '4');
  }

  private triggersFiveSkip(play: Play): boolean {
    // 5が含まれているかチェック
    return play.cards.some(card => card.rank === '5');
  }

  private triggersNineReverse(play: Play): boolean {
    // 9が含まれているかチェック
    return play.cards.some(card => card.rank === '9');
  }

  private triggersSevenPass(play: Play): boolean {
    // 7が含まれているかチェック
    return play.cards.some(card => card.rank === '7');
  }

  private triggersTenDiscard(play: Play): boolean {
    // 10が含まれているかチェック
    return play.cards.some(card => card.rank === '10');
  }

  private triggersQueenBomber(play: Play): boolean {
    // Qが含まれているかチェック
    return play.cards.some(card => card.rank === 'Q');
  }

  private triggersSandstorm(play: Play): boolean {
    // 3のスリーカード（3枚）かチェック
    return play.type === PlayType.TRIPLE &&
           play.cards.every(card => card.rank === '3');
  }

  private triggersSpadeThreeReturn(play: Play, gameState: GameState): boolean {
    // スペード3の1枚出しかチェック
    if (play.type !== PlayType.SINGLE) return false;
    if (play.cards[0].suit !== Suit.SPADE || play.cards[0].rank !== '3') return false;

    // 場にジョーカーがあるかチェック
    if (gameState.field.isEmpty()) return false;
    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory) return false;

    return fieldPlayHistory.play.cards.some(card => card.rank === 'JOKER');
  }

  private triggersDownNumber(play: Play, gameState: GameState): boolean {
    // 1枚出しかチェック
    if (play.type !== PlayType.SINGLE) return false;
    if (gameState.field.isEmpty()) return false;

    const fieldPlayHistory = gameState.field.getLastPlay();
    if (!fieldPlayHistory || fieldPlayHistory.play.type !== PlayType.SINGLE) return false;

    const playCard = play.cards[0];
    const fieldCard = fieldPlayHistory.play.cards[0];

    // 同じスートで1小さい数字かチェック
    return playCard.suit === fieldCard.suit &&
           playCard.strength === fieldCard.strength - 1;
  }

  private triggersLuckySeven(play: Play): boolean {
    // 7のスリーカード（3枚）かチェック
    return play.type === PlayType.TRIPLE &&
           play.cards.every(card => card.rank === '7');
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
   * 誰かがプレイ可能かチェック
   */
  private canAnyonePlay(gameState: GameState): boolean {
    const activePlayers = gameState.players.filter(p => !p.isFinished);

    for (const player of activePlayers) {
      // プレイヤーの全ての手札の組み合わせをチェック
      const cards = player.hand.getCards();

      // 各カードの組み合わせをチェック
      for (let i = 0; i < cards.length; i++) {
        // 1枚
        const validation = this.ruleEngine.validate(player, [cards[i]], gameState.field, gameState);
        if (validation.valid) {
          return true;
        }

        // 2枚
        for (let j = i + 1; j < cards.length; j++) {
          const validation = this.ruleEngine.validate(player, [cards[i], cards[j]], gameState.field, gameState);
          if (validation.valid) {
            return true;
          }

          // 3枚
          for (let k = j + 1; k < cards.length; k++) {
            const validation = this.ruleEngine.validate(player, [cards[i], cards[j], cards[k]], gameState.field, gameState);
            if (validation.valid) {
              return true;
            }

            // 4枚
            for (let l = k + 1; l < cards.length; l++) {
              const validation = this.ruleEngine.validate(player, [cards[i], cards[j], cards[k], cards[l]], gameState.field, gameState);
              if (validation.valid) {
                return true;
              }

              // 5枚以上は階段のみなので、より効率的にチェック可能だが、簡略化のため省略
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 誰も出せないためゲームを終了
   * 手札が少ない順に順位を設定
   */
  private endGameDueToNoPlays(gameState: GameState): void {
    const activePlayers = gameState.players.filter(p => !p.isFinished);

    // 手札が少ない順にソート
    activePlayers.sort((a, b) => a.hand.size() - b.hand.size());

    // 順位を設定
    let currentPosition = gameState.players.filter(p => p.isFinished).length + 1;
    let previousHandSize = -1;
    let sameRankCount = 0;

    for (const player of activePlayers) {
      const handSize = player.hand.size();

      // 同じ手札枚数の場合は同順位
      if (handSize === previousHandSize) {
        sameRankCount++;
      } else {
        currentPosition += sameRankCount;
        sameRankCount = 0;
        previousHandSize = handSize;
      }

      player.isFinished = true;
      player.finishPosition = currentPosition;
      this.assignRank(gameState, player);

      console.log(`${player.name} finished in position ${player.finishPosition} (手札: ${handSize}枚)`);
    }
  }
}
