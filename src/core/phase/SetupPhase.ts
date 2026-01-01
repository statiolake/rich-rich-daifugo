import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { CardFactory, Card, Suit } from '../domain/card/Card';
import { Hand } from '../domain/card/Hand';
import { Player } from '../domain/player/Player';
import { PlayerRank } from '../domain/player/PlayerRank';
import { PresentationRequester } from '../domain/presentation/PresentationRequester';

export class SetupPhase implements GamePhase {
  readonly type = GamePhaseType.SETUP;
  private tenhoWinners: Player[] = [];

  constructor(private presentationRequester?: PresentationRequester) {}

  async enter(gameState: GameState): Promise<void> {
    this.tenhoWinners = [];

    // 前ラウンドの状態をリセット
    gameState.trumpRank = null;
    gameState.blindCards = [];

    // デッキを作成してシャッフル
    const deck = CardFactory.createDeck(true);
    this.shuffle(deck);

    // 切り札/ドラルール: 配布前に1枚伏せてその数字が最強に
    if (gameState.ruleSettings.trump) {
      const trumpCard = deck.pop();
      if (trumpCard) {
        gameState.trumpRank = trumpCard.rank;
        gameState.blindCards.push(trumpCard); // 切り札カード自体はブラインドカードとして扱う
        console.log(`切り札/ドラ: ${trumpCard.rank} が最強になりました`);
      }
    }

    // 配布枚数の計算（差別配りを考慮）
    const playerCardCounts = this.calculateCardCounts(gameState, deck.length);

    // ブラインドカードルール: 端数分のカードを抜いて伏せておく
    if (gameState.ruleSettings.blindCard) {
      const totalToDistribute = playerCardCounts.reduce((sum, count) => sum + count, 0);
      const blindCardCount = deck.length - totalToDistribute;
      if (blindCardCount > 0) {
        for (let i = 0; i < blindCardCount; i++) {
          const blindCard = deck.pop();
          if (blindCard) {
            gameState.blindCards.push(blindCard);
          }
        }
        console.log(`ブラインドカード: ${blindCardCount} 枚を伏せました`);
      }
    }

    // プレイヤーに配布
    let deckIndex = 0;
    for (let i = 0; i < gameState.players.length; i++) {
      const playerCards = deck.slice(deckIndex, deckIndex + playerCardCounts[i]);
      gameState.players[i].hand = new Hand(playerCards);
      deckIndex += playerCardCounts[i];
    }

    // 村八分適用（9以上のカードを没収）
    this.applyMurahachibu(gameState);

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
   * 各プレイヤーの配布枚数を計算
   * 差別配りルール: 階級に応じて配布枚数を増減
   * - 大富豪: -2枚
   * - 富豪: -1枚
   * - 平民: 0枚
   * - 貧民: +1枚
   * - 大貧民: +2枚
   */
  private calculateCardCounts(gameState: GameState, deckSize: number): number[] {
    const playerCount = gameState.players.length;
    const baseCardsPerPlayer = Math.floor(deckSize / playerCount);

    // 差別配りルールが有効でない場合は均等に配布
    if (!gameState.ruleSettings.discriminatoryDeal) {
      return gameState.players.map(() => baseCardsPerPlayer);
    }

    // 差別配り: 階級に応じて配布枚数を調整
    const cardCounts = gameState.players.map(player => {
      let adjustment = 0;
      switch (player.rank) {
        case PlayerRank.DAIFUGO:
          adjustment = -2;
          break;
        case PlayerRank.FUGO:
          adjustment = -1;
          break;
        case PlayerRank.HEIMIN:
          adjustment = 0;
          break;
        case PlayerRank.HINMIN:
          adjustment = 1;
          break;
        case PlayerRank.DAIHINMIN:
          adjustment = 2;
          break;
      }
      return Math.max(1, baseCardsPerPlayer + adjustment); // 最低1枚は配布
    });

    console.log('差別配り適用:');
    gameState.players.forEach((player, i) => {
      console.log(`  ${player.name} (${player.rank}): ${cardCounts[i]} 枚`);
    });

    return cardCounts;
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
   * 村八分適用
   * 都落ち後のプレイヤーから9以上のカード（9, 10, J, Q, K, A, 2, Joker）を没収
   */
  private applyMurahachibu(gameState: GameState): void {
    if (!gameState.murahachibuTargetId) return;

    const targetPlayer = gameState.players.find(
      p => p.id === gameState.murahachibuTargetId
    );
    if (!targetPlayer) return;

    // 9以上のカード（strength >= 9）を没収
    // 9=9, 10=10, J=11, Q=12, K=13, A=14, 2=15, JOKER=16
    const cardsToConfiscate = targetPlayer.hand.getCards().filter(card => {
      return card.strength >= 9;
    });

    if (cardsToConfiscate.length > 0) {
      targetPlayer.hand.remove(cardsToConfiscate);
      console.log(`村八分: ${targetPlayer.name} から ${cardsToConfiscate.length} 枚のカードを没収しました`);
      console.log(`没収されたカード: ${cardsToConfiscate.map(c => `${c.rank}${c.suit}`).join(', ')}`);
    }

    // 村八分フラグをクリア
    gameState.murahachibuTargetId = null;
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
