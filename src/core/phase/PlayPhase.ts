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

    // ルール発動フラグ
    let triggeredRules = false;

    // 8切り判定（場をクリアする）
    if (this.triggersEightCut(play)) {
      console.log('8切りが発動しました！');

      // イベント発火
      this.eventBus?.emit('eightCut:triggered', {});

      triggeredRules = true;
    }

    // 救急車判定（9x2で場をクリア）
    if (this.triggersAmbulance(play)) {
      console.log('救急車が発動しました！');

      // イベント発火
      this.eventBus?.emit('ambulance:triggered', {});

      triggeredRules = true;
    }

    // ろくろ首判定（6x2で場をクリア）
    if (this.triggersRokurokubi(play)) {
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
    if (this.triggersEmperor(play)) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`エンペラーが発動しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('emperor:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // クーデター判定（9x3で革命）
    if (this.triggersCoup(play)) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`クーデターが発動しました！ isRevolution: ${gameState.isRevolution}`);

      // イベント発火
      this.eventBus?.emit('coup:triggered', {
        isRevolution: gameState.isRevolution
      });

      triggeredRules = true;
    }

    // 大革命判定（2x4で革命 + 即勝利）
    if (this.triggersGreatRevolution(play)) {
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
    if (play.triggersRevolution) {
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
    if (this.triggersEightCut(play) || this.triggersAmbulance(play) || this.triggersRokurokubi(play)) {
      gameState.field.clear();
      gameState.passCount = 0;
      console.log('場が流れました');
    }

    // 大革命の即勝利処理
    if (this.triggersGreatRevolution(play)) {
      // 残りの手札をすべて削除して即座に上がり
      const remainingCards = player.hand.getCards();
      if (remainingCards.length > 0) {
        player.hand.remove([...remainingCards]);
      }
      this.handlePlayerFinish(gameState, player);
      this.nextPlayer(gameState);
      return;
    }

    // 手札が空になったら上がり（禁止上がりチェック）
    if (player.hand.isEmpty()) {
      // 禁止上がりチェック: J, 2, 8, Joker で上がれない
      const forbiddenRanks = ['J', '2', '8', 'JOKER'];
      const hasForbiddenCard = cards.some(card => forbiddenRanks.includes(card.rank));

      if (hasForbiddenCard) {
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

    this.nextPlayer(gameState);
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

  private nextPlayer(gameState: GameState): void {
    // 次のプレイヤーを見つける（上がっていないプレイヤー）
    let attempts = 0;
    const maxAttempts = gameState.players.length;

    do {
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
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
