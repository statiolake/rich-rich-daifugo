import { describe, it, expect, beforeEach } from 'vitest';
import { PlayPhase } from '../phase/PlayPhase';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { createGameState, GamePhaseType } from '../domain/game/GameState';
import { RuleEngine } from './base/RuleEngine';
import { EventBus } from '../../application/services/EventBus';
import { MockPlayerController } from '../test-helpers/MockPlayerController';
import { MockPresentationRequester } from '../test-helpers/MockPresentationRequester';
import { DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';

describe('CardEffects - 特殊カードの効果', () => {
  let playPhase: PlayPhase;
  let playerControllers: Map<string, MockPlayerController>;
  let presentationRequester: MockPresentationRequester;
  let ruleEngine: RuleEngine;
  let eventBus: EventBus;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    eventBus = new EventBus();
    playerControllers = new Map();
    presentationRequester = new MockPresentationRequester();
    playPhase = new PlayPhase(playerControllers, ruleEngine, eventBus, presentationRequester);
  });

  describe('8切り', () => {
    it('8を出すと場がクリアされる', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const eightCard = CardFactory.create(Suit.SPADE, '8');
      const kingCard = CardFactory.create(Suit.HEART, 'K');
      player1.hand.add([kingCard, eightCard, CardFactory.create(Suit.CLUB, '5')]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '3')]);

      // ゲーム状態作成（forbidden finish とキング牧師をOFFにする）
      const gameState = createGameState([player1, player2], {
        ...DEFAULT_RULE_SETTINGS,
        eightCut: true,
        forbiddenFinish: false,
        kingPastor: false,  // キング牧師を無効化（このテストは8切りのみテスト）
        reKing: false,      // Re:KINGを無効化（このテストは8切りのみテスト）
        kingReverse: false, // Kリバースを無効化（このテストは8切りのみテスト）
        kingsMarch: false,  // キングの行進を無効化（このテストは8切りのみテスト）
        nero: false,        // ネロを無効化（このテストは8切りのみテスト）
        kingsPrivilege: false, // 王の特権を無効化（このテストは8切りのみテスト）
      });
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // コントローラー設定
      const controller1 = new MockPlayerController();
      const controller2 = new MockPlayerController();
      controller1.setNextCardChoice([kingCard]); // まずKを出す
      controller2.setNextCardChoice([]); // Player2はパス
      playerControllers.set('p1', controller1);
      playerControllers.set('p2', controller2);

      // 最初のプレイ（K）
      await playPhase.update(gameState);
      expect(gameState.field.isEmpty()).toBe(false);

      // Player2がパス
      await playPhase.update(gameState);

      // 場がクリアされてPlayer1に戻る
      expect(gameState.field.isEmpty()).toBe(true);
      expect(gameState.currentPlayerIndex).toBe(0);

      // Player1が8を出す（場が空なので出せる）
      controller1.setNextCardChoice([eightCard]);
      await playPhase.update(gameState);

      // 8切りが発動して場がクリアされたことを確認
      expect(gameState.field.isEmpty()).toBe(true);
      expect(presentationRequester.hasEffect('8切り')).toBe(true);
    });
  });

  describe('革命', () => {
    it('4枚の同じランクで革命が発動する', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      const quadCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      player1.hand.add([...quadCards, CardFactory.create(Suit.SPADE, '6')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice(quadCards);
      playerControllers.set('p1', controller1);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      await playPhase.update(gameState);

      expect(gameState.isRevolution).toBe(true);
      expect(presentationRequester.hasEffect('革命')).toBe(true);
    });

    it('革命中にさらに革命を出すと元に戻る', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      const quadCards1 = [
        CardFactory.create(Suit.SPADE, '6'),
        CardFactory.create(Suit.HEART, '6'),
        CardFactory.create(Suit.DIAMOND, '6'),
        CardFactory.create(Suit.CLUB, '6'),
      ];
      const quadCards2 = [
        CardFactory.create(Suit.SPADE, '4'),
        CardFactory.create(Suit.HEART, '4'),
        CardFactory.create(Suit.DIAMOND, '4'),
        CardFactory.create(Suit.CLUB, '4'),
      ];
      player1.hand.add([...quadCards1, CardFactory.create(Suit.SPADE, '7')]);
      player2.hand.add([...quadCards2, CardFactory.create(Suit.HEART, '7')]);

      const controller1 = new MockPlayerController();
      const controller2 = new MockPlayerController();
      controller1.setNextCardChoice(quadCards1);
      controller1.setNextCardChoice([]); // Player1はパス（2回目）
      controller2.setNextCardChoice(quadCards2);
      controller2.setNextCardChoice([]); // Player2はパス（2回目）
      playerControllers.set('p1', controller1);
      playerControllers.set('p2', controller2);

      const gameState = createGameState([player1, player2], {
        ...DEFAULT_RULE_SETTINGS,
        freemason: false,  // フリーメイソンを無効化（このテストは革命のみテスト）
        sixCut: false,     // 6切りを無効化（革命中のカットを防ぐ）
      });
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // 1回目: Player1が6x4で革命発動
      await playPhase.update(gameState);
      expect(gameState.isRevolution).toBe(true);

      // Player2が4x4で革命解除（革命中なので4は6より強い）
      await playPhase.update(gameState);
      expect(gameState.isRevolution).toBe(false);

      // Player1がパス
      await playPhase.update(gameState);

      // Player2がパス -> 場がクリア
      await playPhase.update(gameState);
      expect(gameState.field.isEmpty()).toBe(true);
    });
  });

  describe('11バック', () => {
    it('Jを出すと11バックが発動する', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      const jackCard = CardFactory.create(Suit.SPADE, 'J');
      player1.hand.add([jackCard, CardFactory.create(Suit.HEART, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '3')]);

      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice([jackCard]);
      playerControllers.set('p1', controller1);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      await playPhase.update(gameState);

      expect(gameState.isElevenBack).toBe(true);
      expect(presentationRequester.hasEffect('イレブンバック')).toBe(true);
    });
  });

  describe('5スキップ', () => {
    it('5を出すと次のプレイヤーをスキップする', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);
      const player3 = createPlayer('p3', 'Player 3', PlayerType.CPU);

      const fiveCard = CardFactory.create(Suit.SPADE, '5');
      player1.hand.add([fiveCard, CardFactory.create(Suit.HEART, '6')]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '3')]);
      player3.hand.add([CardFactory.create(Suit.CLUB, '3')]);

      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice([fiveCard]);
      playerControllers.set('p1', controller1);

      const gameState = createGameState([player1, player2, player3], {
        ...DEFAULT_RULE_SETTINGS,
        fiveSkip: true,
      });
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      await playPhase.update(gameState);

      // Player1が5を出した後、Player2をスキップしてPlayer3に行く
      expect(gameState.currentPlayerIndex).toBe(2);
      expect(presentationRequester.hasEffect('5スキップ')).toBe(true);
    });
  });

  describe('9リバース', () => {
    it('9を出すとターン順が逆転する', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);
      const player3 = createPlayer('p3', 'Player 3', PlayerType.CPU);

      const nineCard = CardFactory.create(Suit.SPADE, '9');
      player1.hand.add([nineCard, CardFactory.create(Suit.HEART, '6')]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '3')]);
      player3.hand.add([CardFactory.create(Suit.CLUB, '3')]);

      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice([nineCard]);
      playerControllers.set('p1', controller1);

      const gameState = createGameState([player1, player2, player3], {
        ...DEFAULT_RULE_SETTINGS,
        nineReverse: true,
        nineQuick: false,  // 9クイックを無効化（このテストは9リバースのみテスト）
        nineReturn: false, // 9戻しを無効化（このテストは9リバースのみテスト）
        chestnutPicking: false, // 栗拾いを無効化（このテストは9リバースのみテスト）
      });
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      expect(gameState.isReversed).toBe(false);

      await playPhase.update(gameState);

      expect(gameState.isReversed).toBe(true);
      expect(presentationRequester.hasEffect('9リバース')).toBe(true);
    });
  });
});
