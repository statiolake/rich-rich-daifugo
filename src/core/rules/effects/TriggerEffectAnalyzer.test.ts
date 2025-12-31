import { describe, it, expect } from 'vitest';
import { TriggerEffectAnalyzer } from './TriggerEffectAnalyzer';
import { PlayAnalyzer, PlayType, Play } from '../../domain/card/Play';
import { CardFactory, Suit } from '../../domain/card/Card';
import { GameState, GamePhaseType } from '../../domain/game/GameState';
import { createPlayer, PlayerType } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { DEFAULT_RULE_SETTINGS } from '../../domain/game/RuleSettings';

describe('TriggerEffectAnalyzer', () => {
  const analyzer = new TriggerEffectAnalyzer();

  function createMockGameState(overrides?: Partial<GameState>): GameState {
    return {
      players: [
        createPlayer('1', 'Player1', PlayerType.CPU),
      ],
      currentPlayerIndex: 0,
      field: new Field(),
      discardPile: [],
      phase: GamePhaseType.PLAY,
      isRevolution: false,
      isElevenBack: false,
      elevenBackDuration: 0,
      ruleSettings: { ...DEFAULT_RULE_SETTINGS },
      passCount: 0,
      isEightCutPending: false,
      suitLock: null,
      numberLock: false,
      colorLock: null,
      isReversed: false,
      isTwoBack: false,
      isDamianActive: false,
      isOmenActive: false,
      luckySeven: null,
      parityRestriction: null,
      isTenFreeActive: false,
      isDoubleDigitSealActive: false,
      hotMilkRestriction: null,
      isArthurActive: false,
      deathSentenceTarget: null,
      endCountdownValue: null,
      teleforceCountdown: null,
      round: 1,
      previousDaifugoId: null,
      previousDaihinminId: null,
      previousFugoId: null,
      consecutiveDaifugoWins: 0,
      cityFallOccurred: false,
      isNuclearBombActive: false,
      revolutionCount: 0,
      miyakoOchiAttackerId: null,
      isFirstTurn: true,
      hasDaifugoPassedFirst: false,
      partialLockSuits: null,
      excludedCards: [],
      supplyAidUsed: false,
      scavengingUsed: false,
      guillotineClockCount: null,
      isSuperRevolutionActive: false,
      isReligiousRevolutionActive: false,
      oddEvenRestriction: null,
      murahachibuTargetId: null,
      trumpRank: null,
      blindCards: [],
      ...overrides,
    };
  }

  describe('革命', () => {
    it('4枚の同じランクで革命が発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState();

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('革命');
      expect(effects).not.toContain('革命終了');
    });

    it('革命中に4枚出すと革命終了', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({ isRevolution: true });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('革命終了');
      expect(effects).not.toContain('革命');
    });

    it('オーメン有効時は革命が発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({ isOmenActive: true });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('革命');
      expect(effects).not.toContain('革命終了');
    });
  });

  describe('イレブンバック', () => {
    it('Jを含むプレイでイレブンバック発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'J')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState();

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('イレブンバック');
    });

    it('イレブンバック中にJを出すと解除', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'J')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({ isElevenBack: true });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('イレブンバック解除');
    });
  });

  describe('8切り', () => {
    it('8を含むプレイで8切りが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '8')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, eightCut: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('8切り');
    });

    it('8切りルールがOFFの場合は発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, '8')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, eightCut: false },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('8切り');
    });
  });

  describe('4止め', () => {
    it('8切りPending時に4x2で4止めが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '4'),
        CardFactory.create(Suit.HEART, '4'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fourStop: true },
        isEightCutPending: true,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('4止め');
    });

    it('8切りPendingでない時は4止めが発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '4'),
        CardFactory.create(Suit.HEART, '4'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fourStop: true },
        isEightCutPending: false,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('4止め');
    });
  });

  describe('救急車', () => {
    it('9x2で救急車が発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.HEART, '9'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, ambulance: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('救急車');
    });
  });

  describe('ろくろ首', () => {
    it('6x2でろくろ首が発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.HEART, '6'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, rokurokubi: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('ろくろ首');
    });
  });

  describe('エンペラー', () => {
    it('4種マーク連番でエンペラーが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.DIAMOND, '7'),
        CardFactory.create(Suit.CLUB, '8'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, emperor: true, stairs: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('エンペラー');
    });

    it('通常の階段（同じスートの連番4枚）ではエンペラーが発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.SPADE, '7'),
        CardFactory.create(Suit.SPADE, '8'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, emperor: true, stairs: true },
      });

      const effects = analyzer.analyze(play, gameState);

      // 通常の階段なのでエンペラーは発動しない
      expect(effects).not.toContain('エンペラー');
      expect(effects).not.toContain('エンペラー終了');
    });
  });

  describe('クーデター', () => {
    it('9x3でクーデターが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.HEART, '9'),
        CardFactory.create(Suit.DIAMOND, '9'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, coup: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('クーデター');
    });
  });

  describe('オーメン', () => {
    it('6x3でオーメンが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.DIAMOND, '6'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, omen: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('オーメン');
    });

    it('オーメン有効時は再度オーメンが発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.DIAMOND, '6'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, omen: true },
        isOmenActive: true,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('オーメン');
    });
  });

  describe('大革命', () => {
    it('2x4で大革命が発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '2'),
        CardFactory.create(Suit.HEART, '2'),
        CardFactory.create(Suit.DIAMOND, '2'),
        CardFactory.create(Suit.CLUB, '2'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, greatRevolution: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('大革命＋即勝利');
    });
  });

  describe('砂嵐', () => {
    it('3x3で砂嵐が発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '3'),
        CardFactory.create(Suit.HEART, '3'),
        CardFactory.create(Suit.DIAMOND, '3'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, sandstorm: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('砂嵐');
    });
  });

  describe('5スキップ', () => {
    it('5を含むプレイで5スキップが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '5')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fiveSkip: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('5スキップ');
    });
  });

  describe('7渡し', () => {
    it('7を含むプレイで7渡しが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '7')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, sevenPass: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('7渡し');
    });
  });

  describe('10捨て', () => {
    it('10を含むプレイで10捨てが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '10')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tenDiscard: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('10捨て');
    });
  });

  describe('クイーンボンバー', () => {
    it('Qを含むプレイでクイーンボンバーが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'Q')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, queenBomber: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('クイーンボンバー');
    });
  });

  describe('9リバース', () => {
    it('9を含むプレイで9リバースが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '9')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, nineReverse: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('9リバース');
    });
  });

  describe('ラッキーセブン', () => {
    it('7x3でラッキーセブンが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '7'),
        CardFactory.create(Suit.HEART, '7'),
        CardFactory.create(Suit.DIAMOND, '7'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, luckySeven: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('ラッキーセブン');
    });
  });

  describe('マークしばり', () => {
    // 注意: analyze() は field.addPlay() の前に呼ばれる想定。
    // 今回のプレイは play 引数で渡され、前回のプレイが field に入っている状態。

    it('場が空の時に1枚出してもマークしばりは発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'K')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, suitLock: true },
      });
      // 場は空

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('マークしばり');
    });

    it('場にカードがある時に同じマークを出すとマークしばりが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'K')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に前回のプレイ（スペード）がある状態を作成
      const field = new Field();
      const prevPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, 'Q')])!;
      field.addPlay(prevPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, suitLock: true },
        field,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('マークしばり');
    });

    it('場にカードがある時に異なるマークを出してもマークしばりは発動しない', () => {
      const cards = [CardFactory.create(Suit.HEART, 'K')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に前回のプレイ（スペード）がある状態を作成
      const field = new Field();
      const prevPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, 'Q')])!;
      field.addPlay(prevPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, suitLock: true },
        field,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('マークしばり');
    });

    it('既にマークしばりが発動している場合は再度発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, 'K')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に前回のプレイ（スペード）がある状態を作成
      const field = new Field();
      const prevPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, 'Q')])!;
      field.addPlay(prevPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, suitLock: true },
        field,
        suitLock: Suit.SPADE, // 既に縛りが発動中
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('マークしばり');
    });
  });

  describe('数字しばり', () => {
    // 注意: analyze() は field.addPlay() の前に呼ばれる想定。
    // 今回のプレイは play 引数で渡され、前回のプレイが field に入っている状態。

    it('場が空の時に階段を出しても数字しばりは発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.SPADE, '7'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, numberLock: true, stairs: true },
      });
      // 場は空

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('数字しばり');
    });

    it('場に階段がある時に階段を出すと数字しばりが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '8'),
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.SPADE, '10'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に前回のプレイ（階段）がある状態を作成
      const field = new Field();
      const prevPlay = PlayAnalyzer.analyze([
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.HEART, '7'),
      ])!;
      field.addPlay(prevPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, numberLock: true, stairs: true },
        field,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('数字しばり');
    });

    it('既に数字しばりが発動している場合は再度発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '8'),
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.SPADE, '10'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に前回のプレイ（階段）がある状態を作成
      const field = new Field();
      const prevPlay = PlayAnalyzer.analyze([
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.HEART, '7'),
      ])!;
      field.addPlay(prevPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, numberLock: true, stairs: true },
        field,
        numberLock: true, // 既に縛りが発動中
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('数字しばり');
    });
  });

  describe('10返し', () => {
    it('8切りPending時に同スートの10を出すと10返しが発動', () => {
      const cards = [CardFactory.create(Suit.SPADE, '10')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に8を置く
      const field = new Field();
      const eightPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, '8')])!;
      field.addPlay(eightPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tenCounter: true },
        field,
        isEightCutPending: true,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('10返し');
    });

    it('8切りPending時でも異なるスートの10では10返しが発動しない', () => {
      const cards = [CardFactory.create(Suit.HEART, '10')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場にスペードの8を置く
      const field = new Field();
      const eightPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, '8')])!;
      field.addPlay(eightPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tenCounter: true },
        field,
        isEightCutPending: true,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('10返し');
    });

    it('8切りPendingでない時は10返しが発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, '10')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に8を置く
      const field = new Field();
      const eightPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, '8')])!;
      field.addPlay(eightPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tenCounter: true },
        field,
        isEightCutPending: false, // 8切りPendingでない
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('10返し');
    });

    it('tenCounterルールがOFFの場合は発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, '10')];
      const play = PlayAnalyzer.analyze(cards)!;

      // 場に8を置く
      const field = new Field();
      const eightPlay = PlayAnalyzer.analyze([CardFactory.create(Suit.SPADE, '8')])!;
      field.addPlay(eightPlay, { value: 'player1' } as any);

      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tenCounter: false },
        field,
        isEightCutPending: true,
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('10返し');
    });
  });

  describe('強化8切り', () => {
    it('8x3で強化8切りが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '8'),
        CardFactory.create(Suit.HEART, '8'),
        CardFactory.create(Suit.DIAMOND, '8'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, enhancedEightCut: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('強化8切り');
    });

    it('8x2では強化8切りが発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '8'),
        CardFactory.create(Suit.HEART, '8'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, enhancedEightCut: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('強化8切り');
    });

    it('8x1では強化8切りが発動しない', () => {
      const cards = [CardFactory.create(Suit.SPADE, '8')];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, enhancedEightCut: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('強化8切り');
    });

    it('enhancedEightCutルールがOFFの場合は発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '8'),
        CardFactory.create(Suit.HEART, '8'),
        CardFactory.create(Suit.DIAMOND, '8'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, enhancedEightCut: false },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('強化8切り');
    });
  });

  describe('複数エフェクトの同時発動', () => {
    it('9x2で救急車と9リバースが同時に発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.HEART, '9'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: {
          ...DEFAULT_RULE_SETTINGS,
          ambulance: true,
          nineReverse: true,
        },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('救急車');
      expect(effects).toContain('9リバース');
      expect(effects).toContain('栗拾い'); // 9を出すと栗拾いも発動
      expect(effects).toContain('9クイック'); // 9を出すと9クイックも発動
      expect(effects).toContain('9戻し'); // 9を出すと9戻しも発動
      expect(effects).toContain('弱見せ'); // 9を出すと弱見せも発動
      expect(effects).toHaveLength(6);
    });

    it('9x3でクーデターと9リバースが同時に発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '9'),
        CardFactory.create(Suit.HEART, '9'),
        CardFactory.create(Suit.DIAMOND, '9'),
      ];
      const play = PlayAnalyzer.analyze(cards)!;
      const gameState = createMockGameState({
        ruleSettings: {
          ...DEFAULT_RULE_SETTINGS,
          coup: true,
          nineReverse: true,
        },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('クーデター');
      expect(effects).toContain('9リバース');
      expect(effects).toContain('栗拾い'); // 9を出すと栗拾いも発動
      expect(effects).toContain('銀河鉄道999'); // 9x3で銀河鉄道999も発動
      expect(effects).toContain('9クイック'); // 9を出すと9クイックも発動
      expect(effects).toContain('9戻し'); // 9を出すと9戻しも発動
      expect(effects).toContain('弱見せ'); // 9を出すと弱見せも発動
      expect(effects).toHaveLength(7);
    });
  });

  describe('テポドン', () => {
    it('同数4枚＋ジョーカー2枚でテポドンが発動', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
        CardFactory.createJoker(),
        CardFactory.createJoker(),
      ];
      const play = PlayAnalyzer.analyze(cards, false, false, { enableTaepodong: true })!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, taepodong: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('テポドン');
    });

    it('ジョーカーが1枚ではテポドンは発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
        CardFactory.createJoker(),
      ];
      // 5枚の組み合わせはテポドンにならないので、通常のQUAD + Jokerとして扱う
      // PlayAnalyzerでは5枚の同数+Joker1枚は認識されないのでnullが返る
      // この場合はテポドンではないことを確認するため、QUADとして作成
      const play: Play = {
        cards,
        type: PlayType.QUAD,
        strength: cards[0].strength,
      };
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, taepodong: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('テポドン');
    });

    it('taepodongルールがOFFの場合は発動しない', () => {
      const cards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
        CardFactory.createJoker(),
        CardFactory.createJoker(),
      ];
      const play = PlayAnalyzer.analyze(cards, false, false, { enableTaepodong: true })!;
      const gameState = createMockGameState({
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, taepodong: false },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('テポドン');
    });
  });

  describe('融合革命', () => {
    it('場のペアに同ランクのペアを追加して4枚で融合革命が発動', () => {
      const field = new Field();
      // 場に3のペアを出す
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '3'),
        CardFactory.create(Suit.HEART, '3'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から3のペアを出す
      const handCards = [
        CardFactory.create(Suit.DIAMOND, '3'),
        CardFactory.create(Suit.CLUB, '3'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fusionRevolution: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('融合革命');
    });

    it('場のシングルに3枚を追加して4枚で融合革命が発動', () => {
      const field = new Field();
      // 場に3のシングルを出す
      const fieldCards = [CardFactory.create(Suit.SPADE, '5')];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から5のトリプルを出す
      const handCards = [
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fusionRevolution: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('融合革命');
    });

    it('異なるランクでは融合革命が発動しない', () => {
      const field = new Field();
      // 場に3のペアを出す
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '3'),
        CardFactory.create(Suit.HEART, '3'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から5のペアを出す（ランクが違う）
      const handCards = [
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fusionRevolution: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('融合革命');
    });

    it('合計3枚では融合革命が発動しない', () => {
      const field = new Field();
      // 場に3のシングルを出す
      const fieldCards = [CardFactory.create(Suit.SPADE, '3')];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から3のペアを出す（合計3枚）
      const handCards = [
        CardFactory.create(Suit.HEART, '3'),
        CardFactory.create(Suit.DIAMOND, '3'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fusionRevolution: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('融合革命');
    });

    it('fusionRevolutionルールがOFFの場合は発動しない', () => {
      const field = new Field();
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '3'),
        CardFactory.create(Suit.HEART, '3'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      const handCards = [
        CardFactory.create(Suit.DIAMOND, '3'),
        CardFactory.create(Suit.CLUB, '3'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, fusionRevolution: false },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('融合革命');
    });
  });

  describe('追革', () => {
    it('場のペアと同ランクのペアで追革が発動', () => {
      const field = new Field();
      // 場に5のペアを出す
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から5のペアを出す
      const handCards = [
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tsuiKaku: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).toContain('追革');
    });

    it('場がペアでない場合は追革が発動しない', () => {
      const field = new Field();
      // 場に5のトリプルを出す
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から5のペアを出す
      const handCards = [
        CardFactory.create(Suit.CLUB, '5'),
        CardFactory.createJoker(),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tsuiKaku: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('追革');
    });

    it('異なるランクでは追革が発動しない', () => {
      const field = new Field();
      // 場に5のペアを出す
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      // 手札から7のペアを出す（ランクが違う）
      const handCards = [
        CardFactory.create(Suit.DIAMOND, '7'),
        CardFactory.create(Suit.CLUB, '7'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tsuiKaku: true },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('追革');
    });

    it('tsuiKakuルールがOFFの場合は発動しない', () => {
      const field = new Field();
      const fieldCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
      ];
      const fieldPlay = PlayAnalyzer.analyze(fieldCards)!;
      field.addPlay(fieldPlay, createPlayer('1', 'Player1', PlayerType.CPU).id);

      const handCards = [
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      const play = PlayAnalyzer.analyze(handCards)!;
      const gameState = createMockGameState({
        field,
        ruleSettings: { ...DEFAULT_RULE_SETTINGS, tsuiKaku: false },
      });

      const effects = analyzer.analyze(play, gameState);

      expect(effects).not.toContain('追革');
    });
  });
});
