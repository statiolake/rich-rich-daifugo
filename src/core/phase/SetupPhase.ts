import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { CardFactory, Card, Suit } from '../domain/card/Card';
import { Hand } from '../domain/card/Hand';
import { Player } from '../domain/player/Player';
import { PresentationRequester } from '../domain/presentation/PresentationRequester';

export class SetupPhase implements GamePhase {
  readonly type = GamePhaseType.SETUP;
  private tenhoWinners: Player[] = [];

  constructor(private presentationRequester?: PresentationRequester) {}

  async enter(gameState: GameState): Promise<void> {
    this.tenhoWinners = [];

    // デッキを作成してシャッフル
    const deck = CardFactory.createDeck(true);
    this.shuffle(deck);

    // プレイヤーに配布
    const cardsPerPlayer = Math.floor(deck.length / gameState.players.length);

    for (let i = 0; i < gameState.players.length; i++) {
      const playerCards = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
      gameState.players[i].hand = new Hand(playerCards);
    }

    // 各プレイヤーの手札をソート（革命XOR11バック）
    const shouldReverseStrength = gameState.isRevolution !== gameState.isElevenBack;
    gameState.players.forEach(p => p.hand.sort(shouldReverseStrength));

    console.log('Setup phase: Cards dealt to players');

    // ダイヤ3スタート: ダイヤ3を持っているプレイヤーが親になる
    if (gameState.ruleSettings.diamond3Start) {
      const diamond3HolderIndex = this.findDiamond3Holder(gameState.players);
      if (diamond3HolderIndex !== -1) {
        gameState.currentPlayerIndex = diamond3HolderIndex;
        console.log(`ダイヤ3スタート: ${gameState.players[diamond3HolderIndex].name} が親になりました`);
      }
    }

    // 天和チェック（配布時に手札が全てペアで即上がり）
    if (gameState.ruleSettings.tenho) {
      for (const player of gameState.players) {
        if (this.checkTenhoCondition(player)) {
          console.log(`天和！${player.name} の手札が全てペア！即上がり！`);
          this.tenhoWinners.push(player);
          if (this.presentationRequester) {
            await this.presentationRequester.requestCutIns([{ effect: '天和', variant: 'gold' }]);
          }
        }
      }
    }
  }

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    // 天和による即勝利処理
    if (this.tenhoWinners.length > 0) {
      for (const winner of this.tenhoWinners) {
        const finishedCount = gameState.players.filter(p => p.isFinished).length;
        winner.isFinished = true;
        winner.finishPosition = finishedCount + 1;
        console.log(`天和: ${winner.name} finished in position ${winner.finishPosition}`);
        // 手札を空にする
        winner.hand.remove([...winner.hand.getCards()]);
      }
    }

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

  /**
   * ダイヤ3を持っているプレイヤーのインデックスを取得
   */
  private findDiamond3Holder(players: Player[]): number {
    for (let i = 0; i < players.length; i++) {
      const hasDiamond3 = players[i].hand.getCards().some(
        card => card.suit === Suit.DIAMOND && card.rank === '3'
      );
      if (hasDiamond3) {
        return i;
      }
    }
    return -1; // 見つからない場合（通常はあり得ない）
  }

  /**
   * 天和条件判定（手札が全てペアか）
   * - 手札枚数が偶数である
   * - 全てのカードがペアになっている（同じランクのカードが2枚ずつ）
   * - ジョーカーは任意のカードとペアになれる
   */
  private checkTenhoCondition(player: Player): boolean {
    const cards = player.hand.getCards();

    // 手札枚数が偶数でなければ発動しない
    if (cards.length % 2 !== 0) return false;

    // 手札が空なら発動しない
    if (cards.length === 0) return false;

    // ランクごとにカード枚数をカウント
    const rankCount = new Map<string, number>();
    let jokerCount = 0;

    for (const card of cards) {
      if (card.rank === 'JOKER') {
        jokerCount++;
      } else {
        rankCount.set(card.rank, (rankCount.get(card.rank) || 0) + 1);
      }
    }

    // 各ランクの枚数が偶数かつジョーカーで補填できるかチェック
    // シンプルに: 奇数枚数のランクの数がジョーカー枚数以下であればOK
    let oddRankCount = 0;
    for (const count of rankCount.values()) {
      if (count % 2 !== 0) {
        oddRankCount++;
      }
    }

    // 奇数枚数のランクをジョーカーでペアにできるか
    return oddRankCount <= jokerCount;
  }
}
