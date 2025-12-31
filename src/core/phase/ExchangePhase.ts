import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { Player } from '../domain/player/Player';
import { PlayerRank } from '../domain/player/PlayerRank';
import { Card, Suit } from '../domain/card/Card';
import { PlayerController } from '../domain/player/PlayerController';
import { PresentationRequester } from '../domain/presentation/PresentationRequester';

/**
 * カード交換フェーズ
 *
 * 2ラウンド目以降、ランクに基づいてカード交換を行う:
 * - 大富豪 ⇔ 大貧民: 2枚交換
 * - 富豪 ⇔ 貧民: 1枚交換
 *
 * 天変地異ルール:
 * - 貧民/大貧民が10以下のカードのみを持っている場合、交換が免除される
 */
export class ExchangePhase implements GamePhase {
  readonly type = GamePhaseType.EXCHANGE;
  private monopolyWinners: Player[] = [];

  constructor(
    private playerControllers: Map<string, PlayerController>,
    private presentationRequester: PresentationRequester
  ) {}

  async enter(gameState: GameState): Promise<void> {
    console.log('=== Exchange Phase ===');
    this.monopolyWinners = [];

    // 1ラウンド目は交換なし
    if (gameState.round === 1) {
      console.log('1ラウンド目のため交換はスキップ');
    } else {
      // 大富豪と大貧民の交換（2枚）
      await this.performExchange(gameState, PlayerRank.DAIFUGO, PlayerRank.DAIHINMIN, 2);

      // 富豪と貧民の交換（1枚）
      await this.performExchange(gameState, PlayerRank.FUGO, PlayerRank.HINMIN, 1);

      // 賠償金（都落ち後も継続参加で先に上がった全員と追加1枚交換）
      await this.performReparations(gameState);
    }

    // モノポリーチェック（同スートA〜K全13枚を所持で即勝利）
    // 交換後に判定（1ラウンド目でも初期配布で発動する可能性あり）
    if (gameState.ruleSettings.monopoly) {
      for (const player of gameState.players) {
        if (!player.isFinished && this.checkMonopolyCondition(player)) {
          console.log(`モノポリー！${player.name} が同スートA〜K全13枚を所持！即勝利！`);
          this.monopolyWinners.push(player);
          await this.presentationRequester.requestCutIns([{ effect: 'モノポリー', variant: 'gold' }]);
        }
      }
    }

    console.log('======================');
  }

  async update(gameState: GameState): Promise<GamePhaseType | null> {
    // モノポリーによる即勝利処理
    if (this.monopolyWinners.length > 0) {
      for (const winner of this.monopolyWinners) {
        const finishedCount = gameState.players.filter(p => p.isFinished).length;
        winner.isFinished = true;
        winner.finishPosition = finishedCount + 1;
        console.log(`モノポリー: ${winner.name} finished in position ${winner.finishPosition}`);
        // 手札を空にする
        winner.hand.remove([...winner.hand.getCards()]);
      }
    }

    // 交換が終わったらPLAYフェーズへ
    return GamePhaseType.PLAY;
  }

  async exit(_gameState: GameState): Promise<void> {
    // クリーンアップ
  }

  /**
   * カード交換を実行
   * @param highRank 高ランク（大富豪/富豪）
   * @param lowRank 低ランク（大貧民/貧民）
   * @param cardCount 交換枚数
   */
  private async performExchange(
    gameState: GameState,
    highRank: PlayerRank,
    lowRank: PlayerRank,
    cardCount: number
  ): Promise<void> {
    const highPlayer = gameState.players.find(p => p.rank === highRank);
    const lowPlayer = gameState.players.find(p => p.rank === lowRank);

    if (!highPlayer || !lowPlayer) {
      console.log(`${highRank} または ${lowRank} のプレイヤーが見つかりません`);
      return;
    }

    // 天変地異チェック
    if (gameState.ruleSettings.catastrophe && this.checkCatastrophe(lowPlayer)) {
      console.log(`天変地異！${lowPlayer.name} は10以下のカードのみのため交換免除`);
      await this.presentationRequester.requestCutIns([{ effect: '天変地異', variant: 'gold' }]);
      return;
    }

    // 低ランクプレイヤーから最強カードを取得
    const strongestCards = this.getStrongestCards(lowPlayer, cardCount, gameState.isRevolution);
    if (strongestCards.length === 0) {
      console.log(`${lowPlayer.name} から交換するカードがありません`);
      return;
    }

    // 高ランクプレイヤーがカードを選択
    const controller = this.playerControllers.get(highPlayer.id.value);
    if (!controller) {
      // CPUの場合は最弱カードを自動選択
      const weakestCards = this.getWeakestCards(highPlayer, strongestCards.length, gameState.isRevolution);
      this.swapCards(highPlayer, lowPlayer, weakestCards, strongestCards, gameState);
      return;
    }

    // 人間プレイヤーの場合、カードを選択させる
    const selectedCards = await controller.chooseCardsForExchange(
      [...highPlayer.hand.getCards()],
      strongestCards.length,
      `${lowPlayer.name} に渡すカードを${strongestCards.length}枚選んでください`
    );

    this.swapCards(highPlayer, lowPlayer, selectedCards, strongestCards, gameState);
  }

  /**
   * 天変地異チェック
   * プレイヤーの手札が全て10以下（革命時は10以上）かどうか
   */
  private checkCatastrophe(player: Player): boolean {
    const cards = player.hand.getCards();
    if (cards.length === 0) return false;

    // 10の強さ = 10（通常時）
    const tenStrength = 10;

    return cards.every(card => {
      // Jokerは除外
      if (card.rank === 'JOKER') return false;
      return card.strength <= tenStrength;
    });
  }

  /**
   * 最強カードを取得
   */
  private getStrongestCards(player: Player, count: number, isRevolution: boolean): Card[] {
    const cards = [...player.hand.getCards()];

    // 強さでソート（革命時は逆順）
    cards.sort((a, b) => {
      const diff = b.strength - a.strength;
      return isRevolution ? -diff : diff;
    });

    return cards.slice(0, count);
  }

  /**
   * 最弱カードを取得
   */
  private getWeakestCards(player: Player, count: number, isRevolution: boolean): Card[] {
    const cards = [...player.hand.getCards()];

    // 弱さでソート（革命時は逆順）
    cards.sort((a, b) => {
      const diff = a.strength - b.strength;
      return isRevolution ? -diff : diff;
    });

    return cards.slice(0, count);
  }

  /**
   * カードを交換
   */
  private swapCards(
    highPlayer: Player,
    lowPlayer: Player,
    highToLow: Card[],
    lowToHigh: Card[],
    gameState: GameState
  ): void {
    // 高ランクから低ランクへ
    highPlayer.hand.remove(highToLow);
    lowPlayer.hand.add(highToLow);

    // 低ランクから高ランクへ
    lowPlayer.hand.remove(lowToHigh);
    highPlayer.hand.add(lowToHigh);

    console.log(`${highPlayer.name} → ${lowPlayer.name}: ${highToLow.map(c => `${c.rank}${c.suit}`).join(', ')}`);
    console.log(`${lowPlayer.name} → ${highPlayer.name}: ${lowToHigh.map(c => `${c.rank}${c.suit}`).join(', ')}`);

    // ソート
    const shouldReverse = gameState.isRevolution;
    highPlayer.hand.sort(shouldReverse);
    lowPlayer.hand.sort(shouldReverse);
  }

  /**
   * 賠償金（都税）処理
   * 都落ち後も継続参加で先に上がった全員と追加1枚交換
   */
  private async performReparations(gameState: GameState): Promise<void> {
    if (!gameState.ruleSettings.reparations) return;
    if (!gameState.cityFallOccurred) return;
    if (!gameState.previousDaifugoId) return;

    // 前の大富豪（都落ちした人）を見つける
    const fallenDaifugo = gameState.players.find(
      p => p.id.value === gameState.previousDaifugoId
    );
    if (!fallenDaifugo) return;

    // 都落ちした人より先に上がったプレイヤー（前ラウンドのfinishPositionで判定）
    // 都落ちしたということは、前の大富豪が1位でなかったということ
    // つまり前ラウンドで1位になったプレイヤーと交換
    const winner = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (!winner || winner.id.value === fallenDaifugo.id.value) return;

    console.log(`賠償金発動！${fallenDaifugo.name} は都落ちのため ${winner.name} と追加1枚交換`);

    // 都落ちした人から最強カード1枚を取得
    const strongestCard = this.getStrongestCards(fallenDaifugo, 1, gameState.isRevolution);
    if (strongestCard.length === 0) {
      console.log(`${fallenDaifugo.name} から交換するカードがありません`);
      return;
    }

    // 勝者から最弱カード1枚を取得
    const weakestCard = this.getWeakestCards(winner, 1, gameState.isRevolution);
    if (weakestCard.length === 0) {
      console.log(`${winner.name} から交換するカードがありません`);
      return;
    }

    // カード交換を実行
    this.swapCards(winner, fallenDaifugo, weakestCard, strongestCard, gameState);
    console.log(`賠償金: ${fallenDaifugo.name} → ${winner.name}: ${strongestCard.map(c => `${c.rank}${c.suit}`).join(', ')}`);
    console.log(`賠償金: ${winner.name} → ${fallenDaifugo.name}: ${weakestCard.map(c => `${c.rank}${c.suit}`).join(', ')}`);
  }

  /**
   * モノポリー条件判定（同スートA〜K全13枚を所持）
   * いずれかのスートでA, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K の13枚全てを持っている
   */
  private checkMonopolyCondition(player: Player): boolean {
    const cards = player.hand.getCards();

    // スートごとにランクをセットで管理
    const suitRanks: Record<string, Set<string>> = {
      [Suit.SPADE]: new Set(),
      [Suit.HEART]: new Set(),
      [Suit.DIAMOND]: new Set(),
      [Suit.CLUB]: new Set(),
    };

    // 全ランクのリスト
    const allRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

    for (const card of cards) {
      // ジョーカーはスキップ
      if (card.rank === 'JOKER') continue;
      if (suitRanks[card.suit]) {
        suitRanks[card.suit].add(card.rank);
      }
    }

    // いずれかのスートで13枚全て持っているかチェック
    for (const suit of [Suit.SPADE, Suit.HEART, Suit.DIAMOND, Suit.CLUB]) {
      if (suitRanks[suit].size === 13) {
        // 全ランクが含まれているか確認
        const hasAllRanks = allRanks.every(rank => suitRanks[suit].has(rank));
        if (hasAllRanks) {
          console.log(`${player.name} は ${suit} の全13枚を持っています！`);
          return true;
        }
      }
    }

    return false;
  }
}
