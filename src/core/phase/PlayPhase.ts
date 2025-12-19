import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerStrategy } from '../strategy/PlayerStrategy';
import { PlayValidator } from '../rules/basic/PlayValidator';
import { Card } from '../domain/card/Card';
import { PlayAnalyzer } from '../domain/card/Play';
import { Player } from '../domain/player/Player';
import { PlayerRank } from '../domain/player/PlayerRank';

export class PlayPhase implements GamePhase {
  readonly type = GamePhaseType.PLAY;

  constructor(
    private strategyMap: Map<string, PlayerStrategy>,
    private validator: PlayValidator
  ) {}

  async enter(gameState: GameState): Promise<void> {
    gameState.field.clear();
    gameState.passCount = 0;

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
    const validation = this.validator.isValidPlay(player, cards, gameState.field, gameState);
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

    // 革命判定
    if (play.triggersRevolution) {
      gameState.isRevolution = !gameState.isRevolution;
      console.log(`革命が発生しました！ isRevolution: ${gameState.isRevolution}`);

      // 全プレイヤーの手札を再ソート
      gameState.players.forEach(p => p.hand.sort(gameState.isRevolution));
    }

    // 手札が空になったら上がり
    if (player.hand.isEmpty()) {
      this.handlePlayerFinish(gameState, player);
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
