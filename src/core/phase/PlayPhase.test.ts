import { describe, it, expect, beforeEach } from 'vitest';
import { PlayPhase } from './PlayPhase';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { createGameState, GamePhaseType } from '../domain/game/GameState';
import { RuleEngine } from '../rules/base/RuleEngine';

describe('PlayPhase - 11バック機能', () => {
  let playPhase: PlayPhase;
  let strategyMap: Map<string, any>;
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    strategyMap = new Map();
    playPhase = new PlayPhase(strategyMap, ruleEngine);
    // waitForCutInFnをモック（即座に解決）
    playPhase.setWaitForCutIn(async () => {});
  });

  describe('11バックの発動', () => {
    it('Jが出されたときに11バックが発動する', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jackCard = CardFactory.create(Suit.SPADE, 'J');
      player1.hand.add([jackCard, CardFactory.create(Suit.HEART, 'Q')]); // 複数枚追加して上がらないようにする
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;

      // 初期状態では11バックはfalse
      expect(gameState.isElevenBack).toBe(false);

      // 戦略設定（手札の中のJを出す）
      strategyMap.set(player1.id.value, {
        decidePlay: async () => ({
          type: 'PLAY',
          cards: [jackCard]
        })
      });

      // Jを出す
      await playPhase.update(gameState);

      // 11バックが発動したことを確認
      expect(gameState.isElevenBack).toBe(true);
    });

    it('Jが再度出されたときに11バックが解除される', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jack1 = CardFactory.create(Suit.SPADE, 'J');
      const jack2 = CardFactory.create(Suit.HEART, 'J');
      player1.hand.add([jack1, jack2, CardFactory.create(Suit.CLUB, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.CLUB, '3')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isElevenBack = false;

      // 1回目のJ
      strategyMap.set(player1.id.value, {
        decidePlay: async () => ({
          type: 'PLAY',
          cards: [jack1]
        })
      });

      await playPhase.update(gameState);
      expect(gameState.isElevenBack).toBe(true);

      // 2回目のJ
      gameState.currentPlayerIndex = 0;
      strategyMap.set(player1.id.value, {
        decidePlay: async () => ({
          type: 'PLAY',
          cards: [jack2]
        })
      });

      await playPhase.update(gameState);
      expect(gameState.isElevenBack).toBe(false);
    });
  });

  describe('11バックのリセット', () => {
    it('場が流れたときに11バックがリセットされる', async () => {
      // 4人プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);
      const player3 = createPlayer('p3', 'Player 3', PlayerType.CPU);
      const player4 = createPlayer('p4', 'Player 4', PlayerType.CPU);

      // 手札設定
      const jackCard = CardFactory.create(Suit.SPADE, 'J');
      player1.hand.add([jackCard, CardFactory.create(Suit.SPADE, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);
      player3.hand.add([CardFactory.create(Suit.DIAMOND, '4')]);
      player4.hand.add([CardFactory.create(Suit.CLUB, '5')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2, player3, player4]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isElevenBack = false;

      // Player1がJを出して11バック発動
      strategyMap.set(player1.id.value, {
        decidePlay: async () => ({
          type: 'PLAY',
          cards: [jackCard]
        })
      });

      await playPhase.update(gameState);
      expect(gameState.isElevenBack).toBe(true);

      // Player2, 3, 4がパス
      strategyMap.set(player2.id.value, {
        decidePlay: async () => ({ type: 'PASS' })
      });
      strategyMap.set(player3.id.value, {
        decidePlay: async () => ({ type: 'PASS' })
      });
      strategyMap.set(player4.id.value, {
        decidePlay: async () => ({ type: 'PASS' })
      });

      await playPhase.update(gameState); // Player2パス
      await playPhase.update(gameState); // Player3パス
      await playPhase.update(gameState); // Player4パス（場が流れる）

      // 11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
    });

    it('新しいラウンド開始時に11バックがリセットされる', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.isElevenBack = true; // 11バックがactive

      // 新しいラウンド開始
      await playPhase.enter(gameState);

      // 11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
    });
  });

  describe('革命との組み合わせ', () => {
    it('革命中にJを出すと両方activeになる（XORで通常に戻る）', async () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jackCard = CardFactory.create(Suit.SPADE, 'J');
      player1.hand.add([jackCard, CardFactory.create(Suit.HEART, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isRevolution = true; // 革命中
      gameState.isElevenBack = false;

      // Jを出す
      strategyMap.set(player1.id.value, {
        decidePlay: async () => ({
          type: 'PLAY',
          cards: [jackCard]
        })
      });

      await playPhase.update(gameState);

      // 両方がtrueになっている
      expect(gameState.isRevolution).toBe(true);
      expect(gameState.isElevenBack).toBe(true);

      // XORロジック: true !== true = false（通常の強さ判定に戻る）
      const rev = gameState.isRevolution as boolean;
      const eb = gameState.isElevenBack as boolean;
      const shouldReverse = rev !== eb;
      expect(shouldReverse).toBe(false);
    });
  });
});
