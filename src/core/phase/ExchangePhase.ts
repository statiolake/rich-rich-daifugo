import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { Player } from '../domain/player/Player';
import { PlayerRank } from '../domain/player/PlayerRank';
import { Card } from '../domain/card/Card';
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

  constructor(
    private playerControllers: Map<string, PlayerController>,
    private presentationRequester: PresentationRequester
  ) {}

  async enter(gameState: GameState): Promise<void> {
    console.log('=== Exchange Phase ===');

    // 1ラウンド目は交換なし
    if (gameState.round === 1) {
      console.log('1ラウンド目のため交換はスキップ');
      return;
    }

    // 大富豪と大貧民の交換（2枚）
    await this.performExchange(gameState, PlayerRank.DAIFUGO, PlayerRank.DAIHINMIN, 2);

    // 富豪と貧民の交換（1枚）
    await this.performExchange(gameState, PlayerRank.FUGO, PlayerRank.HINMIN, 1);

    console.log('======================');
  }

  async update(_gameState: GameState): Promise<GamePhaseType | null> {
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
}
