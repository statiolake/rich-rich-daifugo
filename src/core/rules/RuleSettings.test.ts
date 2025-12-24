import { describe, it, expect } from 'vitest';
import { RuleEngine } from './base/RuleEngine';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';
import { createGameState } from '../domain/game/GameState';
import { PlayType, PlayAnalyzer } from '../domain/card/Play';

describe('Rule Settings - ON/OFF Functionality', () => {
  describe('砂嵐 (Sandstorm)', () => {
    it('砂嵐がONの場合、3x3が何にでも勝つ', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 場にKのスリーカードを出す
      const cardK_1 = CardFactory.create(Suit.SPADE, 'K');
      const cardK_2 = CardFactory.create(Suit.HEART, 'K');
      const cardK_3 = CardFactory.create(Suit.DIAMOND, 'K');
      field.addPlay({ cards: [cardK_1, cardK_2, cardK_3], type: PlayType.TRIPLE, strength: 13, triggersRevolution: false }, player.id);

      // 3のスリーカードを手札に追加
      const card3_1 = CardFactory.create(Suit.SPADE, '3');
      const card3_2 = CardFactory.create(Suit.HEART, '3');
      const card3_3 = CardFactory.create(Suit.DIAMOND, '3');
      player.hand.add([card3_1, card3_2, card3_3]);

      // ルール設定：砂嵐ON
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, sandstorm: true });
      gameState.field = field;

      // 3x3が出せるかチェック
      const result = ruleEngine.validate(player, [card3_1, card3_2, card3_3], field, gameState);
      expect(result.valid).toBe(true);
    });

    it('砂嵐がOFFの場合、3x3は通常の強さ判定', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 場にKのスリーカードを出す
      const cardK_1 = CardFactory.create(Suit.SPADE, 'K');
      const cardK_2 = CardFactory.create(Suit.HEART, 'K');
      const cardK_3 = CardFactory.create(Suit.DIAMOND, 'K');
      field.addPlay({ cards: [cardK_1, cardK_2, cardK_3], type: PlayType.TRIPLE, strength: 13, triggersRevolution: false }, player.id);

      // 3のスリーカードを手札に追加
      const card3_1 = CardFactory.create(Suit.SPADE, '3');
      const card3_2 = CardFactory.create(Suit.HEART, '3');
      const card3_3 = CardFactory.create(Suit.DIAMOND, '3');
      player.hand.add([card3_1, card3_2, card3_3]);

      // ルール設定：砂嵐OFF
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, sandstorm: false });
      gameState.field = field;

      // 3x3が出せないかチェック（通常の強さ判定でKには勝てない）
      const result = ruleEngine.validate(player, [card3_1, card3_2, card3_3], field, gameState);
      expect(result.valid).toBe(false);
    });
  });

  describe('階段 (Stairs)', () => {
    it('階段がONの場合、階段を出せる', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 階段を手札に追加（同じマークの連番）
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card5 = CardFactory.create(Suit.SPADE, '5');
      player.hand.add([card3, card4, card5]);

      // ルール設定：階段ON
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, stairs: true });
      gameState.field = field;

      // 階段が出せるかチェック
      const result = ruleEngine.validate(player, [card3, card4, card5], field, gameState);
      expect(result.valid).toBe(true);
    });

    it('階段がOFFの場合、階段を出せない', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 階段を手札に追加（同じマークの連番）
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card5 = CardFactory.create(Suit.SPADE, '5');
      player.hand.add([card3, card4, card5]);

      // ルール設定：階段OFF
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, stairs: false });
      gameState.field = field;

      // 階段が出せないかチェック
      const result = ruleEngine.validate(player, [card3, card4, card5], field, gameState);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('階段は現在使用できません');
    });
  });

  describe('スぺ3返し (Spade 3 return)', () => {
    it('スぺ3返しがONの場合、スペードの3でJokerに勝てる', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 場にJokerを出す（手動でJokerを作成）
      const joker = { id: 'JOKER-1', suit: Suit.JOKER, rank: 'JOKER' as const, strength: 15 };
      field.addPlay({ cards: [joker], type: PlayType.SINGLE, strength: 15, triggersRevolution: false }, player.id);

      // スペードの3を手札に追加
      const spade3 = CardFactory.create(Suit.SPADE, '3');
      player.hand.add([spade3]);

      // ルール設定：スぺ3返しON
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, spadeThreeReturn: true });
      gameState.field = field;

      // スペードの3が出せるかチェック
      const result = ruleEngine.validate(player, [spade3], field, gameState);
      expect(result.valid).toBe(true);
    });

    it('スぺ3返しがOFFの場合、スペードの3でJokerに勝てない', () => {
      const ruleEngine = new RuleEngine();
      const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);
      const field = new Field();

      // 場にJokerを出す（手動でJokerを作成）
      const joker = { id: 'JOKER-1', suit: Suit.JOKER, rank: 'JOKER' as const, strength: 15 };
      field.addPlay({ cards: [joker], type: PlayType.SINGLE, strength: 15, triggersRevolution: false }, player.id);

      // スペードの3を手札に追加
      const spade3 = CardFactory.create(Suit.SPADE, '3');
      player.hand.add([spade3]);

      // ルール設定：スぺ3返しOFF
      const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, spadeThreeReturn: false });
      gameState.field = field;

      // スペードの3が出せないかチェック
      const result = ruleEngine.validate(player, [spade3], field, gameState);
      expect(result.valid).toBe(false);
    });
  });

  describe('Effect Preview Logic (simulating HumanControl getEffects)', () => {
    // HumanControl.tsxのgetEffects()ロジックをシミュレート
    const getEffects = (
      selectedCards: any[],
      gameState: any,
      humanPlayer: any,
      canPlaySelected: boolean
    ): string[] => {
      if (!canPlaySelected || selectedCards.length === 0) return [];

      const play = PlayAnalyzer.analyze(selectedCards);
      if (!play) return [];

      const effects: string[] = [];
      const ruleSettings = gameState.ruleSettings;

      // 革命判定
      if (play.triggersRevolution) {
        effects.push(gameState.isRevolution ? '革命終了' : '革命');
      }

      // イレブンバック判定
      if (play.cards.some((card: any) => card.rank === 'J')) {
        effects.push(gameState.isElevenBack ? 'イレブンバック解除' : 'イレブンバック');
      }

      // 8切り判定
      if (ruleSettings.eightCut && play.cards.some((card: any) => card.rank === '8')) {
        effects.push('8切り');
      }

      // 救急車判定（9x2）
      if (ruleSettings.ambulance && play.type === PlayType.PAIR && play.cards.every((card: any) => card.rank === '9')) {
        effects.push('救急車');
      }

      // ろくろ首判定（6x2）
      if (ruleSettings.rokurokubi && play.type === PlayType.PAIR && play.cards.every((card: any) => card.rank === '6')) {
        effects.push('ろくろ首');
      }

      // エンペラー判定（4種マーク連番）
      if (ruleSettings.emperor && play.type === PlayType.STAIR && play.cards.length === 4) {
        const suits = new Set(play.cards.map((card: any) => card.suit));
        if (suits.size === 4) {
          effects.push(gameState.isRevolution ? 'エンペラー終了' : 'エンペラー');
        }
      }

      // クーデター判定（9x3）
      if (ruleSettings.coup && play.type === PlayType.TRIPLE && play.cards.every((card: any) => card.rank === '9')) {
        effects.push(gameState.isRevolution ? 'クーデター終了' : 'クーデター');
      }

      // 大革命判定（2x4）
      if (ruleSettings.greatRevolution && play.type === PlayType.QUAD && play.cards.every((card: any) => card.rank === '2')) {
        effects.push('大革命＋即勝利');
      }

      // 砂嵐判定（3x3）
      if (ruleSettings.sandstorm && play.type === PlayType.TRIPLE && play.cards.every((card: any) => card.rank === '3')) {
        effects.push('砂嵐');
      }

      // スぺ3返し判定
      const fieldPlay = gameState.field.getCurrentPlay();
      if (ruleSettings.spadeThreeReturn && play.type === PlayType.SINGLE && selectedCards.length === 1 &&
          selectedCards[0].rank === '3' && selectedCards[0].suit === 'SPADE' &&
          fieldPlay && fieldPlay.cards.length === 1 && fieldPlay.cards[0].rank === 'JOKER') {
        effects.push('スぺ3返し');
      }

      // 禁止上がり判定
      const remainingCards = humanPlayer.hand.size() - selectedCards.length;
      if (remainingCards === 0) {
        const forbiddenRanks = ['J', '2', '8', 'JOKER'];
        const hasForbiddenCard = selectedCards.some((card: any) => forbiddenRanks.includes(card.rank));
        if (ruleSettings.forbiddenFinish && hasForbiddenCard) {
          effects.push('⚠️禁止上がり');
        }
      }

      return effects;
    };

    describe('8切り preview', () => {
      it('8切りがONの場合、8を選択すると「8切り」がエフェクトに含まれる', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card8 = CardFactory.create(Suit.SPADE, '8');
        player.hand.add([card8]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, eightCut: true });

        const effects = getEffects([card8], gameState, player, true);

        expect(effects).toContain('8切り');
      });

      it('8切りがOFFの場合、8を選択しても「8切り」がエフェクトに含まれない', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card8 = CardFactory.create(Suit.SPADE, '8');
        player.hand.add([card8]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, eightCut: false });

        const effects = getEffects([card8], gameState, player, true);

        expect(effects).not.toContain('8切り');
      });
    });

    describe('砂嵐 preview', () => {
      it('砂嵐がONの場合、3x3を選択すると「砂嵐」がエフェクトに含まれる', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card3_1 = CardFactory.create(Suit.SPADE, '3');
        const card3_2 = CardFactory.create(Suit.HEART, '3');
        const card3_3 = CardFactory.create(Suit.DIAMOND, '3');
        player.hand.add([card3_1, card3_2, card3_3]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, sandstorm: true });

        const effects = getEffects([card3_1, card3_2, card3_3], gameState, player, true);

        expect(effects).toContain('砂嵐');
      });

      it('砂嵐がOFFの場合、3x3を選択しても「砂嵐」がエフェクトに含まれない', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card3_1 = CardFactory.create(Suit.SPADE, '3');
        const card3_2 = CardFactory.create(Suit.HEART, '3');
        const card3_3 = CardFactory.create(Suit.DIAMOND, '3');
        player.hand.add([card3_1, card3_2, card3_3]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, sandstorm: false });

        const effects = getEffects([card3_1, card3_2, card3_3], gameState, player, true);

        expect(effects).not.toContain('砂嵐');
      });
    });

    describe('禁止上がり preview', () => {
      it('禁止上がりがONで最後のJを選択すると「⚠️禁止上がり」がエフェクトに含まれる', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const cardJ = CardFactory.create(Suit.SPADE, 'J');
        player.hand.add([cardJ]); // 手札1枚のみ

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, forbiddenFinish: true });

        const effects = getEffects([cardJ], gameState, player, true);

        expect(effects).toContain('⚠️禁止上がり');
      });

      it('禁止上がりがOFFで最後のJを選択しても「⚠️禁止上がり」がエフェクトに含まれない', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const cardJ = CardFactory.create(Suit.SPADE, 'J');
        player.hand.add([cardJ]); // 手札1枚のみ

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, forbiddenFinish: false });

        const effects = getEffects([cardJ], gameState, player, true);

        expect(effects).not.toContain('⚠️禁止上がり');
      });
    });

    describe('救急車 preview', () => {
      it('救急車がONの場合、9x2を選択すると「救急車」がエフェクトに含まれる', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card9_1 = CardFactory.create(Suit.SPADE, '9');
        const card9_2 = CardFactory.create(Suit.HEART, '9');
        player.hand.add([card9_1, card9_2]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, ambulance: true });

        const effects = getEffects([card9_1, card9_2], gameState, player, true);

        expect(effects).toContain('救急車');
      });

      it('救急車がOFFの場合、9x2を選択しても「救急車」がエフェクトに含まれない', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card9_1 = CardFactory.create(Suit.SPADE, '9');
        const card9_2 = CardFactory.create(Suit.HEART, '9');
        player.hand.add([card9_1, card9_2]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, ambulance: false });

        const effects = getEffects([card9_1, card9_2], gameState, player, true);

        expect(effects).not.toContain('救急車');
      });
    });

    describe('大革命 preview', () => {
      it('大革命がONの場合、2x4を選択すると「大革命＋即勝利」がエフェクトに含まれる', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card2_1 = CardFactory.create(Suit.SPADE, '2');
        const card2_2 = CardFactory.create(Suit.HEART, '2');
        const card2_3 = CardFactory.create(Suit.DIAMOND, '2');
        const card2_4 = CardFactory.create(Suit.CLUB, '2');
        player.hand.add([card2_1, card2_2, card2_3, card2_4]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, greatRevolution: true });

        const effects = getEffects([card2_1, card2_2, card2_3, card2_4], gameState, player, true);

        expect(effects).toContain('大革命＋即勝利');
      });

      it('大革命がOFFの場合、2x4を選択しても「大革命＋即勝利」がエフェクトに含まれない', () => {
        const player = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
        const card2_1 = CardFactory.create(Suit.SPADE, '2');
        const card2_2 = CardFactory.create(Suit.HEART, '2');
        const card2_3 = CardFactory.create(Suit.DIAMOND, '2');
        const card2_4 = CardFactory.create(Suit.CLUB, '2');
        player.hand.add([card2_1, card2_2, card2_3, card2_4]);

        const gameState = createGameState([player], { ...DEFAULT_RULE_SETTINGS, greatRevolution: false });

        const effects = getEffects([card2_1, card2_2, card2_3, card2_4], gameState, player, true);

        expect(effects).not.toContain('大革命＋即勝利');
        // ただし通常の革命は表示される
        expect(effects).toContain('革命');
      });
    });
  });
});
