import { Card, CardFactory, Suit } from './Card';

export enum PlayType {
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  STAIR = 'STAIR',              // 階段（同じスートの連番）
  SKIP_STAIR = 'SKIP_STAIR',    // 飛び階段（同スートで公差がある3枚以上、例：4,6,8）
  DOUBLE_STAIR = 'DOUBLE_STAIR', // 二列階段/一盃口（同ランク2枚ずつで階段、例：3x2,4x2,5x2）
  EMPEROR = 'EMPEROR',          // エンペラー（4種類のスートの連番4枚）
  TUNNEL = 'TUNNEL',            // トンネル（A→2→3の階段、最弱の階段）
  SPADE_STAIR = 'SPADE_STAIR',  // スペ階（♠2→Joker→♠3の階段、最強で場が流れる）
  TAEPODONG = 'TAEPODONG',      // テポドン（同数4枚＋ジョーカー2枚、革命＋即上がり）
  // 特殊ルール用
  CROSS_DRESSING = 'CROSS_DRESSING',    // 女装（QとKの混合出し）
  SOUTHERN_CROSS = 'SOUTHERN_CROSS',    // サザンクロス（3,3,9,6）
  HEIANKYO_FLOW = 'HEIANKYO_FLOW',      // 平安京流し（同スート7,9,4）
  CYCLONE = 'CYCLONE',                  // サイクロン（同スート3,A,9,6）
  KONAGONA = 'KONAGONA',                // 粉々革命（同色5×2,7×2）
  YOROSHIKU = 'YOROSHIKU',              // 世露死苦革命（4,6,4,9）
  SHININASAI = 'SHININASAI',            // 死になさい革命（♠4,2,7,3,A）
}

export interface Play {
  readonly cards: Card[];
  readonly type: PlayType;
  readonly strength: number;
  /** 飛び階段の公差（SKIP_STAIRタイプの場合のみ有効） */
  readonly skipStairDiff?: number;
}

export interface AnalyzeOptions {
  enableSkipStair?: boolean;
  enableDoubleStair?: boolean;
  enableTunnel?: boolean;
  enableSpadeStair?: boolean;
  enableTaepodong?: boolean;
}

export class PlayAnalyzer {
  /**
   * カードの組み合わせを分析してPlayオブジェクトを生成
   * 無効な組み合わせの場合はnullを返す
   * @param enableSkipStair 飛び階段を有効にするか（デフォルト: false）
   * @param enableDoubleStair 二列階段を有効にするか（デフォルト: false）
   * @param options 追加オプション（enableTunnel, enableSpadeStair）
   */
  static analyze(cards: Card[], enableSkipStair: boolean = false, enableDoubleStair: boolean = false, options?: AnalyzeOptions): Play | null {
    const enableTunnel = options?.enableTunnel ?? false;
    const enableSpadeStair = options?.enableSpadeStair ?? false;
    const enableTaepodong = options?.enableTaepodong ?? false;
    if (cards.length === 0) {
      return null;
    }

    // テポドンチェック（6枚: 同数4枚＋ジョーカー2枚）
    if (cards.length === 6 && enableTaepodong && this.isTaepodong(cards)) {
      // テポドンの強さは最強（どのプレイよりも強い）
      const nonJokers = cards.filter(c => c.rank !== 'JOKER');
      return {
        cards,
        type: PlayType.TAEPODONG,
        strength: nonJokers.length > 0 ? nonJokers[0].strength : 14,
      };
    }

    // 1枚出し
    if (cards.length === 1) {
      return {
        cards,
        type: PlayType.SINGLE,
        strength: cards[0].strength,
      };
    }

    // 2枚出し（ペア）
    if (cards.length === 2) {
      if (this.isPair(cards)) {
        return {
          cards,
          type: PlayType.PAIR,
          strength: cards[0].strength,
        };
      }
      return null;
    }

    // 3枚出し（スリーカード）
    if (cards.length === 3) {
      if (this.isTriple(cards)) {
        return {
          cards,
          type: PlayType.TRIPLE,
          strength: cards[0].strength,
        };
      }
      // スペ階チェック（♠2→Joker→♠3の最強階段）- 先にチェック
      if (enableSpadeStair && this.isSpadeStair(cards)) {
        return {
          cards,
          type: PlayType.SPADE_STAIR,
          strength: 100, // 最強（どの階段よりも強い）
        };
      }
      // トンネルチェック（A→2→3の最弱階段）- 通常の階段より先にチェック
      if (enableTunnel && this.isTunnel(cards)) {
        return {
          cards,
          type: PlayType.TUNNEL,
          strength: 0, // 最弱（どの階段よりも弱い）
        };
      }
      // 階段チェック（3枚以上の連続した数字）
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
        };
      }
      // 飛び階段チェック（3枚以上、同スート、公差2〜6）
      if (enableSkipStair) {
        const skipDiff = this.isSkipStair(cards);
        if (skipDiff > 0) {
          return {
            cards,
            type: PlayType.SKIP_STAIR,
            strength: Math.max(...cards.map(c => c.strength)),
            skipStairDiff: skipDiff,
          };
        }
      }
      return null;
    }

    // 4枚出し（フォーカード、革命）
    if (cards.length === 4) {
      if (this.isQuad(cards)) {
        return {
          cards,
          type: PlayType.QUAD,
          strength: cards[0].strength,
        };
      }
      // エンペラーチェック（4種類のスートの連番4枚）
      if (this.isEmperor(cards)) {
        return {
          cards,
          type: PlayType.EMPEROR,
          strength: Math.max(...cards.map(c => c.strength)),
        };
      }
      // 階段チェック
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
        };
      }
      // 飛び階段チェック
      if (enableSkipStair) {
        const skipDiff = this.isSkipStair(cards);
        if (skipDiff > 0) {
          return {
            cards,
            type: PlayType.SKIP_STAIR,
            strength: Math.max(...cards.map(c => c.strength)),
            skipStairDiff: skipDiff,
          };
        }
      }
      return null;
    }

    // 5枚以上
    if (cards.length >= 5) {
      // 通常の階段
      if (this.isStair(cards)) {
        return {
          cards,
          type: PlayType.STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
        };
      }
      // 飛び階段チェック
      if (enableSkipStair) {
        const skipDiff = this.isSkipStair(cards);
        if (skipDiff > 0) {
          return {
            cards,
            type: PlayType.SKIP_STAIR,
            strength: Math.max(...cards.map(c => c.strength)),
            skipStairDiff: skipDiff,
          };
        }
      }
      // 二列階段チェック（6枚以上の偶数枚）
      if (enableDoubleStair && this.isDoubleStair(cards)) {
        return {
          cards,
          type: PlayType.DOUBLE_STAIR,
          strength: Math.max(...cards.map(c => c.strength)),
        };
      }
      return null;
    }

    return null;
  }

  /**
   * 前のプレイに対して、現在のプレイが出せるかどうかを判定
   */
  static canFollow(previous: Play, current: Play, isRevolution: boolean): boolean {
    // タイプが異なる場合は出せない（階段は階段、ペアはペアのみ）
    // ただし、トンネルとスペ階は通常の階段と同じ扱い
    const stairLikeTypes = [PlayType.STAIR, PlayType.TUNNEL, PlayType.SPADE_STAIR];
    const prevIsStairLike = stairLikeTypes.includes(previous.type);
    const currIsStairLike = stairLikeTypes.includes(current.type);

    if (prevIsStairLike && currIsStairLike) {
      // 両方が階段系の場合、枚数チェックのみ
      if (previous.cards.length !== current.cards.length) {
        return false;
      }
    } else if (previous.type !== current.type) {
      return false;
    }

    // 階段の場合、枚数が同じでなければならない
    if (previous.type === PlayType.STAIR && current.type === PlayType.STAIR) {
      if (previous.cards.length !== current.cards.length) {
        return false;
      }
    }

    // 飛び階段の場合、枚数が同じで公差も同じでなければならない
    if (previous.type === PlayType.SKIP_STAIR && current.type === PlayType.SKIP_STAIR) {
      if (previous.cards.length !== current.cards.length) {
        return false;
      }
      if (previous.skipStairDiff !== current.skipStairDiff) {
        return false;
      }
    }

    // 二列階段の場合、枚数が同じでなければならない
    if (previous.type === PlayType.DOUBLE_STAIR && current.type === PlayType.DOUBLE_STAIR) {
      if (previous.cards.length !== current.cards.length) {
        return false;
      }
    }

    // トンネル同士の場合は強さチェック不要（PlayValidatorで制御）
    if (previous.type === PlayType.TUNNEL || current.type === PlayType.TUNNEL) {
      return true;
    }

    // スペ階同士の場合は強さチェック不要（PlayValidatorで制御）
    if (previous.type === PlayType.SPADE_STAIR || current.type === PlayType.SPADE_STAIR) {
      return true;
    }

    // 革命時は強さの判定が逆になる
    const prevStrength = CardFactory.getEffectiveStrength(
      { ...previous.cards[0], strength: previous.strength } as Card,
      isRevolution
    );
    const currStrength = CardFactory.getEffectiveStrength(
      { ...current.cards[0], strength: current.strength } as Card,
      isRevolution
    );

    return currStrength > prevStrength;
  }

  /**
   * ペア（2枚の同じランク）かどうかを判定
   */
  private static isPair(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    // ジョーカーは別扱い
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    if (nonJokers.length === 1) return true; // ジョーカー1枚+通常カード1枚
    return nonJokers[0].rank === nonJokers[1].rank;
  }

  /**
   * スリーカード（3枚の同じランク）かどうかを判定
   */
  private static isTriple(cards: Card[]): boolean {
    if (cards.length !== 3) return false;
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    const firstRank = nonJokers[0].rank;
    return nonJokers.every(c => c.rank === firstRank);
  }

  /**
   * フォーカード（4枚の同じランク）かどうかを判定
   */
  private static isQuad(cards: Card[]): boolean {
    if (cards.length !== 4) return false;
    const nonJokers = cards.filter(c => c.rank !== 'JOKER');
    if (nonJokers.length === 0) return false;
    const firstRank = nonJokers[0].rank;
    return nonJokers.every(c => c.rank === firstRank);
  }

  /**
   * 階段（同じマークの連続した数字）かどうかを判定
   * 最低3枚以上
   */
  static isStair(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    // ジョーカーは階段では使えない（シンプルなルール）
    if (cards.some(c => c.rank === 'JOKER')) {
      return false;
    }

    // 同じマークかチェック
    const suits = new Set(cards.map(c => c.suit));
    if (suits.size !== 1) {
      return false;
    }

    // 強さでソート
    const sorted = [...cards].sort((a, b) => a.strength - b.strength);

    // 連続しているかチェック
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].strength !== sorted[i - 1].strength + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * エンペラー（4種類のスートの連番4枚）かどうかをチェック
   */
  static isEmperor(cards: Card[]): boolean {
    if (cards.length !== 4) return false;

    // ジョーカーは使えない
    if (cards.some(c => c.rank === 'JOKER')) {
      return false;
    }

    // 4種類の異なるスートか
    const suits = new Set(cards.map(c => c.suit));
    if (suits.size !== 4) return false;

    // 強さでソート
    const sorted = [...cards].sort((a, b) => a.strength - b.strength);

    // 連続しているかチェック
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].strength !== sorted[i - 1].strength + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * 飛び階段（同スートで公差がある3枚以上）かどうかを判定
   * 例: 4,6,8（公差2）、3,6,9（公差3）
   * @returns 公差（2〜6）または0（飛び階段でない場合）
   */
  static isSkipStair(cards: Card[]): number {
    if (cards.length < 3) return 0;

    // ジョーカーは使えない
    if (cards.some(c => c.rank === 'JOKER')) {
      return 0;
    }

    // 同じマークかチェック
    const suits = new Set(cards.map(c => c.suit));
    if (suits.size !== 1) {
      return 0;
    }

    // 強さでソート
    const sorted = [...cards].sort((a, b) => a.strength - b.strength);

    // 公差を計算
    const diff = sorted[1].strength - sorted[0].strength;

    // 公差が2〜6の範囲内かチェック
    // 公差1は通常の階段なので飛び階段ではない
    if (diff < 2 || diff > 6) {
      return 0;
    }

    // 等差数列になっているかチェック
    for (let i = 2; i < sorted.length; i++) {
      if (sorted[i].strength - sorted[i - 1].strength !== diff) {
        return 0;
      }
    }

    return diff;
  }

  /**
   * 二列階段（同ランク2枚ずつで階段を構成）かどうかを判定
   * 例: 3x2, 4x2, 5x2（6枚）
   * @returns 二列階段かどうか
   */
  static isDoubleStair(cards: Card[]): boolean {
    // 最低6枚（3組のペア）で偶数枚である必要がある
    if (cards.length < 6 || cards.length % 2 !== 0) {
      return false;
    }

    // ジョーカーは使えない
    if (cards.some(c => c.rank === 'JOKER')) {
      return false;
    }

    // ランクごとにグループ化
    const rankGroups = new Map<string, Card[]>();
    for (const card of cards) {
      const group = rankGroups.get(card.rank) || [];
      group.push(card);
      rankGroups.set(card.rank, group);
    }

    // 各ランクが2枚ずつであること
    for (const group of rankGroups.values()) {
      if (group.length !== 2) {
        return false;
      }
    }

    // 強さでソートして連続しているかチェック
    const strengths = Array.from(rankGroups.values())
      .map(group => group[0].strength)
      .sort((a, b) => a - b);

    // 連続しているかチェック
    for (let i = 1; i < strengths.length; i++) {
      if (strengths[i] !== strengths[i - 1] + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * トンネル（A→2→3の階段）かどうかを判定
   * 通常はA→2→3は強さが飛ぶため階段にならないが、このルールでは特殊な最弱階段として扱う
   * 同じスートのA, 2, 3の3枚で構成される
   */
  static isTunnel(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    // ジョーカーは使えない
    if (cards.some(c => c.rank === 'JOKER')) {
      return false;
    }

    // 同じスートかチェック
    const suits = new Set(cards.map(c => c.suit));
    if (suits.size !== 1) {
      return false;
    }

    // A, 2, 3が含まれているかチェック
    const ranks = new Set(cards.map(c => c.rank));
    return ranks.has('A') && ranks.has('2') && ranks.has('3');
  }

  /**
   * スペ階（♠2→Joker→♠3の階段）かどうかを判定
   * スペードの2、ジョーカー、スペードの3の3枚で構成される最強の階段
   * 場が流れる効果を持つ
   */
  static isSpadeStair(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    // 各カードの条件をチェック
    let hasSpadeTwo = false;
    let hasJoker = false;
    let hasSpadeThree = false;

    for (const card of cards) {
      if (card.rank === '2' && card.suit === Suit.SPADE) {
        hasSpadeTwo = true;
      } else if (card.rank === 'JOKER') {
        hasJoker = true;
      } else if (card.rank === '3' && card.suit === Suit.SPADE) {
        hasSpadeThree = true;
      }
    }

    return hasSpadeTwo && hasJoker && hasSpadeThree;
  }

  /**
   * テポドン判定（同数4枚＋ジョーカー2枚）
   */
  static isTaepodong(cards: Card[]): boolean {
    if (cards.length !== 6) return false;

    // ジョーカーの枚数をカウント
    const jokers = cards.filter(card => card.rank === 'JOKER');
    if (jokers.length !== 2) return false;

    // 残り4枚が同じランクか確認
    const nonJokers = cards.filter(card => card.rank !== 'JOKER');
    if (nonJokers.length !== 4) return false;

    const rank = nonJokers[0].rank;
    return nonJokers.every(card => card.rank === rank);
  }
}
