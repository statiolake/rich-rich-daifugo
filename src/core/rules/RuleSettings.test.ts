import { describe, it, expect } from 'vitest';
import { RuleEngine } from './base/RuleEngine';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { Field } from '../domain/game/Field';
import { DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';
import { createGameState } from '../domain/game/GameState';
import { PlayType } from '../domain/card/Play';

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
});
