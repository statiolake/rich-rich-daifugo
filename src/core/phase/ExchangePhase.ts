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
      // 交換枚数を計算
      const exchangeCount = this.calculateExchangeCount(gameState);

      // 絶対王政または通常交換
      if (gameState.ruleSettings.absoluteMonarchy) {
        // 絶対王政: 富豪1枚、貧民2枚、大貧民3枚を大富豪に献上
        await this.performAbsoluteMonarchyExchange(gameState);
      } else {
        // 大富豪と大貧民の交換
        await this.performExchange(gameState, PlayerRank.DAIFUGO, PlayerRank.DAIHINMIN, exchangeCount.daifugo);

        // 富豪と貧民の交換
        await this.performExchange(gameState, PlayerRank.FUGO, PlayerRank.HINMIN, exchangeCount.fugo);
      }

      // 独占禁止法: 大富豪に2とJokerが5枚以上で2を他プレイヤーに配布
      await this.performAntiMonopoly(gameState);

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

    // 伏せ交換チェック: 貧民が裏向きで並べ、富豪が任意位置から抜く
    // 簡易実装: 富豪がランダムに選ぶ（実質同じ効果）
    let cardsFromLow: Card[];
    if (gameState.ruleSettings.blindExchange) {
      cardsFromLow = this.getRandomCards(lowPlayer, cardCount);
      console.log(`伏せ交換！${highPlayer.name} が ${lowPlayer.name} の手札からランダムに選択`);
      await this.presentationRequester.requestCutIns([{ effect: '伏せ交換', variant: 'gold' }]);
    } else {
      // 通常: 低ランクプレイヤーから最強カードを取得
      cardsFromLow = this.getStrongestCards(lowPlayer, cardCount, gameState.isRevolution);
    }

    if (cardsFromLow.length === 0) {
      console.log(`${lowPlayer.name} から交換するカードがありません`);
      return;
    }

    // 高ランクプレイヤーがカードを選択
    const controller = this.playerControllers.get(highPlayer.id);
    if (!controller) {
      // CPUの場合は最弱カードを自動選択
      const weakestCards = this.getWeakestCards(highPlayer, cardsFromLow.length, gameState.isRevolution);
      this.swapCards(highPlayer, lowPlayer, weakestCards, cardsFromLow, gameState);
      return;
    }

    // 人間プレイヤーの場合、カードを選択させる
    const selectedCards = await controller.chooseCardsForExchange(
      [...highPlayer.hand.getCards()],
      cardsFromLow.length,
      `${lowPlayer.name} に渡すカードを${cardsFromLow.length}枚選んでください`
    );

    this.swapCards(highPlayer, lowPlayer, selectedCards, cardsFromLow, gameState);
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
   * ランダムにカードを取得（伏せ交換用）
   */
  private getRandomCards(player: Player, count: number): Card[] {
    const cards = [...player.hand.getCards()];

    // Fisher-Yatesシャッフル
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

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
      p => p.id === gameState.previousDaifugoId
    );
    if (!fallenDaifugo) return;

    // 都落ちした人より先に上がったプレイヤー（前ラウンドのfinishPositionで判定）
    // 都落ちしたということは、前の大富豪が1位でなかったということ
    // つまり前ラウンドで1位になったプレイヤーと交換
    const winner = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (!winner || winner.id === fallenDaifugo.id) return;

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
   * 交換枚数を計算
   * 王政防衛/相続税ルールによる増加を考慮
   */
  private calculateExchangeCount(gameState: GameState): { daifugo: number; fugo: number } {
    let daifugoCount = 2;
    let fugoCount = 1;

    // 王政防衛: 連続大富豪で交換枚数が連続回数＋1枚に増加
    if (gameState.ruleSettings.monarchyDefense && gameState.consecutiveDaifugoWins > 0) {
      daifugoCount = gameState.consecutiveDaifugoWins + 1;
      console.log(`王政防衛発動！交換枚数が${daifugoCount}枚に増加`);
    }

    // 相続税: 連続大富豪で交換枚数が3→4→5枚と増加
    if (gameState.ruleSettings.inheritanceTax && gameState.consecutiveDaifugoWins > 0) {
      daifugoCount = Math.min(2 + gameState.consecutiveDaifugoWins, 5);
      console.log(`相続税発動！交換枚数が${daifugoCount}枚に増加`);
    }

    return { daifugo: daifugoCount, fugo: fugoCount };
  }

  /**
   * 絶対王政による交換処理
   * 富豪1枚、貧民2枚、大貧民3枚を大富豪に献上
   */
  private async performAbsoluteMonarchyExchange(gameState: GameState): Promise<void> {
    const daifugo = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (!daifugo) {
      console.log('大富豪が見つかりません');
      return;
    }

    console.log('絶対王政発動！全員が大富豪に献上');
    await this.presentationRequester.requestCutIns([{ effect: '絶対王政', variant: 'gold' }]);

    // 富豪から1枚
    const fugo = gameState.players.find(p => p.rank === PlayerRank.FUGO);
    if (fugo) {
      const cards = this.getStrongestCards(fugo, 1, gameState.isRevolution);
      if (cards.length > 0) {
        fugo.hand.remove(cards);
        daifugo.hand.add(cards);
        console.log(`${fugo.name} → ${daifugo.name}: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);
      }
    }

    // 貧民から2枚
    const hinmin = gameState.players.find(p => p.rank === PlayerRank.HINMIN);
    if (hinmin) {
      const cards = this.getStrongestCards(hinmin, 2, gameState.isRevolution);
      if (cards.length > 0) {
        hinmin.hand.remove(cards);
        daifugo.hand.add(cards);
        console.log(`${hinmin.name} → ${daifugo.name}: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);
      }
    }

    // 大貧民から3枚
    const daihinmin = gameState.players.find(p => p.rank === PlayerRank.DAIHINMIN);
    if (daihinmin) {
      const cards = this.getStrongestCards(daihinmin, 3, gameState.isRevolution);
      if (cards.length > 0) {
        daihinmin.hand.remove(cards);
        daifugo.hand.add(cards);
        console.log(`${daihinmin.name} → ${daifugo.name}: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);
      }
    }

    // ソート
    const shouldReverse = gameState.isRevolution;
    daifugo.hand.sort(shouldReverse);
  }

  /**
   * 独占禁止法による処理
   * 大富豪に2とJokerが5枚以上で2を他プレイヤーに配布
   */
  private async performAntiMonopoly(gameState: GameState): Promise<void> {
    if (!gameState.ruleSettings.antiMonopoly) return;

    const daifugo = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (!daifugo) return;

    // 2とJokerの枚数をカウント
    const cards = daifugo.hand.getCards();
    const twosAndJokers = cards.filter(c => c.rank === '2' || c.rank === 'JOKER');
    const twos = cards.filter(c => c.rank === '2');

    if (twosAndJokers.length >= 5 && twos.length > 0) {
      console.log('独占禁止法発動！大富豪の2を他プレイヤーに配布');
      await this.presentationRequester.requestCutIns([{ effect: '独占禁止法', variant: 'gold' }]);

      // 2を1枚ずつ他のプレイヤーに配布
      const otherPlayers = gameState.players.filter(p => p.id !== daifugo.id);
      for (let i = 0; i < Math.min(twos.length, otherPlayers.length); i++) {
        const cardToGive = twos[i];
        const targetPlayer = otherPlayers[i];
        daifugo.hand.remove([cardToGive]);
        targetPlayer.hand.add([cardToGive]);
        console.log(`${daifugo.name} → ${targetPlayer.name}: ${cardToGive.rank}${cardToGive.suit}`);
        targetPlayer.hand.sort(gameState.isRevolution);
      }
      daifugo.hand.sort(gameState.isRevolution);
    }
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
