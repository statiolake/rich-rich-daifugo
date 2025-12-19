import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { CardFactory } from '../domain/card/Card';
import { Hand } from '../domain/card/Hand';

export class SetupPhase implements GamePhase {
  readonly type = GamePhaseType.SETUP;

  async enter(gameState: GameState): Promise<void> {
    // デッキを作成してシャッフル
    const deck = CardFactory.createDeck(true);
    this.shuffle(deck);

    // プレイヤーに配布
    const cardsPerPlayer = Math.floor(deck.length / gameState.players.length);

    for (let i = 0; i < gameState.players.length; i++) {
      const playerCards = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
      gameState.players[i].hand = new Hand(playerCards);
    }

    // 各プレイヤーの手札をソート
    gameState.players.forEach(p => p.hand.sort(gameState.isRevolution));

    console.log('Setup phase: Cards dealt to players');
  }

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    // Phase 1では交換フェーズをスキップして、直接プレイフェーズへ
    // 将来的にはランクに基づいて交換フェーズに進むかどうかを判定
    return GamePhaseType.PLAY;
  }

  async exit(gameState: GameState): Promise<void> {
    // クリーンアップ処理（現時点では不要）
  }

  private shuffle(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
