import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { CardFactory, Suit } from '../domain/card/Card';
import { Hand } from '../domain/card/Hand';
import { PlayerType } from '../domain/player/Player';

export class SetupPhase implements GamePhase {
  readonly type = GamePhaseType.SETUP;

  async enter(gameState: GameState): Promise<void> {
    // デッキを作成してシャッフル
    const deck = CardFactory.createDeck(true);
    this.shuffle(deck);

    // 【デバッグ用】人間プレイヤーにJJJJを配るため、デッキから取り出す
    const humanPlayerIndex = gameState.players.findIndex(p => p.type === PlayerType.HUMAN);
    const jacks = [
      CardFactory.create(Suit.SPADE, 'J'),
      CardFactory.create(Suit.HEART, 'J'),
      CardFactory.create(Suit.DIAMOND, 'J'),
      CardFactory.create(Suit.CLUB, 'J'),
    ];

    // デッキからJJJJを除外
    const deckWithoutJacks = deck.filter(card => card.rank !== 'J');

    // プレイヤーに配布
    const cardsPerPlayer = Math.floor(deckWithoutJacks.length / gameState.players.length);

    for (let i = 0; i < gameState.players.length; i++) {
      if (i === humanPlayerIndex) {
        // 人間プレイヤーにはJJJJ + 通常のカード
        const playerCards = deckWithoutJacks.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
        gameState.players[i].hand = new Hand([...jacks, ...playerCards]);
        console.log('デバッグ: 人間プレイヤーにJJJJを配りました');
      } else {
        // その他のプレイヤーには通常のカードのみ
        const playerCards = deckWithoutJacks.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
        gameState.players[i].hand = new Hand(playerCards);
      }
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
