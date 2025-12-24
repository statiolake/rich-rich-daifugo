import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { Card } from '../domain/card/Card';
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
      gameState.field.clear();
      gameState.passCount = 0;
      gameState.isEightCutPending = false; // 場をクリアしたら8切りフラグもリセット
      gameState.suitLock = null; // 場をクリアしたら縛りもリセット
      gameState.numberLock = false; // 場をクリアしたら数字しばりもリセット
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

    // 手札が空になったら上がり（禁止上がりチェック）
    if (player.hand.isEmpty()) {
      // 禁止上がりチェック: J, 2, 8, Joker で上がれない
      const forbiddenRanks = ['J', '2', '8', 'JOKER'];
      const hasForbiddenCard = cards.some(card => forbiddenRanks.includes(card.rank));

      if (gameState.ruleSettings.forbiddenFinish && hasForbiddenCard) {
        console.log(`${player.name} は禁止カードで上がることはできません`);
        // カードを手札に戻す
        player.hand.add(cards);
        // 場からもプレイを削除
        gameState.field.clear();
        gameState.passCount = 0;
        // イベント発火
        this.eventBus?.emit('forbiddenFinish:attempted', {
          playerName: player.name
        });
      } else {
        this.handlePlayerFinish(gameState, player);
      }
    }

    // 7渡し判定（手札から1枚ランダムに次のプレイヤーに渡す）
    if (gameState.ruleSettings.sevenPass && this.triggersSevenPass(play) && !player.hand.isEmpty()) {
      const remainingCards = player.hand.getCards();
      if (remainingCards.length > 0) {
        // ランダムに1枚選ぶ
        const randomCard = remainingCards[Math.floor(Math.random() * remainingCards.length)];
        player.hand.remove([randomCard]);

        // 次のプレイヤーに渡す（一時的に次のプレイヤーを取得）
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
          nextPlayer.hand.add([randomCard]);
          console.log(`7渡し発動！${player.name}が${nextPlayer.name}に${randomCard.rank}${randomCard.suit}を渡しました`);

          // イベント発火
          this.eventBus?.emit('sevenPass:triggered', {
            fromPlayer: player.name,
            toPlayer: nextPlayer.name
          });
        }
      }
    }

    // 10捨て判定（手札から1枚ランダムに捨てる）
    if (gameState.ruleSettings.tenDiscard && this.triggersTenDiscard(play) && !player.hand.isEmpty()) {
      const remainingCards = player.hand.getCards();
      if (remainingCards.length > 0) {
        // ランダムに1枚選ぶ
        const randomCard = remainingCards[Math.floor(Math.random() * remainingCards.length)];
        player.hand.remove([randomCard]);
        console.log(`10捨て発動！${player.name}が${randomCard.rank}${randomCard.suit}を捨てました`);

        // イベント発火
        this.eventBus?.emit('tenDiscard:triggered', {
          player: player.name
        });
      }
    }

    // クイーンボンバー判定（全員が手札から1枚ランダムに捨てる）
    if (gameState.ruleSettings.queenBomber && this.triggersQueenBomber(play)) {
      console.log('クイーンボンバー発動！全員が1枚捨てます');

      gameState.players.forEach(p => {
        if (!p.isFinished && !p.hand.isEmpty()) {
          const cards = p.hand.getCards();
          if (cards.length > 0) {
            const randomCard = cards[Math.floor(Math.random() * cards.length)];
            p.hand.remove([randomCard]);
            console.log(`${p.name}が${randomCard.rank}${randomCard.suit}を捨てました`);
          }
        }
      });

      // イベント発火
      this.eventBus?.emit('queenBomber:triggered', {});
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

    // 全員がパスしたら場をクリア（流れる）
    const activePlayers = gameState.players.filter(p => !p.isFinished).length;
    if (gameState.passCount >= activePlayers - 1) {
      console.log('場が流れました');
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
}
