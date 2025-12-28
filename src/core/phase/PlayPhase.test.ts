import { describe, it, expect, beforeEach } from 'vitest';
import { PlayPhase } from './PlayPhase';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { createGameState, GamePhaseType } from '../domain/game/GameState';
import { RuleEngine } from '../rules/base/RuleEngine';
import { EventBus } from '../../application/services/EventBus';
import { MockPlayerController } from '../test-helpers/MockPlayerController';
import { MockPresentationRequester } from '../test-helpers/MockPresentationRequester';

describe('PlayPhase - 11バック機能', () => {
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

  describe('11バックの発動', () => {
    it('Jが出されたときに11バックが発動する', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jackCard = CardFactory.create(Suit.SPADE, 'J');
      player1.hand.add([jackCard, CardFactory.create(Suit.HEART, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      // コントローラー設定
      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice([jackCard]); // Jを出す
      playerControllers.set('p1', controller1);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // 初期状態では11バックはfalse
      expect(gameState.isElevenBack).toBe(false);

      // ターン実行
      await playPhase.update(gameState);

      // 11バックが発動したことを確認
      expect(gameState.isElevenBack).toBe(true);

      // カットインに「イレブンバック」が含まれることを確認
      expect(presentationRequester.hasEffect('イレブンバック')).toBe(true);
    });

    it('Jが再度出されたときに11バックがトグルされる', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jackCard1 = CardFactory.create(Suit.SPADE, 'J');
      const jackCard2 = CardFactory.create(Suit.HEART, 'J');
      player1.hand.add([jackCard1, CardFactory.create(Suit.DIAMOND, '3')]);
      player2.hand.add([jackCard2, CardFactory.create(Suit.CLUB, '3')]);

      // コントローラー設定
      const controller1 = new MockPlayerController();
      const controller2 = new MockPlayerController();
      controller1.setNextCardChoice([jackCard1]); // 最初のJ
      controller1.setNextCardChoice([]); // Player1パス（2回目）
      controller2.setNextCardChoice([]); // Player2パス
      playerControllers.set('p1', controller1);
      playerControllers.set('p2', controller2);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // 初期状態
      expect(gameState.isElevenBack).toBe(false);

      // 1回目: Player1がJを出す（11バック発動）
      await playPhase.update(gameState);
      expect(gameState.isElevenBack).toBe(true);

      // Player2がパス
      await playPhase.update(gameState);

      // Player1がパス → 場がクリア、11バックもリセット
      await playPhase.update(gameState);
      expect(gameState.field.isEmpty()).toBe(true);
      expect(gameState.isElevenBack).toBe(false);

      // Player2がJを出す（再度11バック発動）
      controller2.setNextCardChoice([jackCard2]);
      await playPhase.update(gameState);
      expect(gameState.isElevenBack).toBe(true);
    });
  });

  describe('革命の発動', () => {
    it('4枚の同じランクで革命が発動する', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定（5x4）
      const fiveCards = [
        CardFactory.create(Suit.SPADE, '5'),
        CardFactory.create(Suit.HEART, '5'),
        CardFactory.create(Suit.DIAMOND, '5'),
        CardFactory.create(Suit.CLUB, '5'),
      ];
      player1.hand.add([...fiveCards, CardFactory.create(Suit.SPADE, '6')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      // コントローラー設定
      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice(fiveCards);
      playerControllers.set('p1', controller1);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // 初期状態では革命はfalse
      expect(gameState.isRevolution).toBe(false);

      // ターン実行
      await playPhase.update(gameState);

      // 革命が発動したことを確認
      expect(gameState.isRevolution).toBe(true);

      // カットインに「革命」が含まれることを確認
      expect(presentationRequester.hasEffect('革命')).toBe(true);
    });
  });

  describe('パス処理', () => {
    it('パスすると passCount が増加する', async () => {
      // プレイヤー作成（3人必要 - 2人だと1人パスで場がクリアされる）
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);
      const player3 = createPlayer('p3', 'Player 3', PlayerType.CPU);

      // 手札設定
      const kingCard = CardFactory.create(Suit.DIAMOND, 'K');
      player1.hand.add([kingCard, CardFactory.create(Suit.SPADE, 'A')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);
      player3.hand.add([CardFactory.create(Suit.CLUB, '4')]);

      const gameState = createGameState([player1, player2, player3]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // Player1がKを出す
      const controller1 = new MockPlayerController();
      controller1.setNextCardChoice([kingCard]);
      playerControllers.set('p1', controller1);

      await playPhase.update(gameState);

      // Player2がパス（3ではKに勝てない）
      const controller2 = new MockPlayerController();
      controller2.setNextCardChoice([]); // パス
      playerControllers.set('p2', controller2);

      const initialPassCount = gameState.passCount;
      await playPhase.update(gameState);

      // passCountが増加したことを確認
      expect(gameState.passCount).toBe(initialPassCount + 1);
    });
  });
});
