import { describe, it, expect } from 'vitest';
import { TriggerEffectAnalyzer } from './TriggerEffectAnalyzer';
import { PlayAnalyzer } from '../../domain/card/Play';
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
      phase: GamePhaseType.PLAY,
      isRevolution: false,
      isElevenBack: false,
      ruleSettings: { ...DEFAULT_RULE_SETTINGS },
      passCount: 0,
      isEightCutPending: false,
      suitLock: null,
      numberLock: false,
      isReversed: false,
      isOmenActive: false,
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
      expect(effects).toHaveLength(2);
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
      expect(effects).toHaveLength(2);
    });
  });
});
