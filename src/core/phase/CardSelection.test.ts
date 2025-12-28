import { describe, it, expect, beforeEach } from 'vitest';
import { PlayPhase } from './PlayPhase';
import { CardFactory, Suit } from '../domain/card/Card';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { createGameState, GamePhaseType } from '../domain/game/GameState';
import { RuleEngine } from '../rules/base/RuleEngine';
import { HumanStrategy } from '../strategy/HumanStrategy';

describe('PlayPhase - カード選択リクエスト', () => {
  let playPhase: PlayPhase;
  let strategyMap: Map<string, any>;
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    strategyMap = new Map();
    playPhase = new PlayPhase(strategyMap, ruleEngine);
  });

  describe('10捨て', () => {
    it.skip('10より弱いカードを捨てることができる', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.HUMAN);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // プレイヤー1に10と3を持たせる
      const tenCard = CardFactory.create(Suit.SPADE, '10');
      const threeCard = CardFactory.create(Suit.HEART, '3');
      player1.hand.add([tenCard, threeCard, CardFactory.create(Suit.DIAMOND, 'K')]);
      player2.hand.add([CardFactory.create(Suit.CLUB, '5')]);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.ruleSettings.tenDiscard = true;

      // HumanStrategyを設定（10を出す）
      const humanStrategy = new HumanStrategy();
      strategyMap.set(player1.id.value, humanStrategy);

      // まず10を出す
      setTimeout(() => {
        humanStrategy.submitPlay([tenCard]);
      }, 10);

      // 10を出した後、10捨てのカード選択が始まる
      setTimeout(() => {
        // 3（10より弱いカード）を捨てる
        humanStrategy.submitCardSelection([threeCard]);
      }, 20);

      await playPhase.update(gameState);

      // 3が手札から削除されたことを確認
      expect(player1.hand.getCards().some(c => c.id === threeCard.id)).toBe(false);
    });
  });

  describe('7渡し', () => {
    it.skip('任意のカードを次のプレイヤーに渡すことができる', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.HUMAN);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // プレイヤー1に7とAを持たせる
      const sevenCard = CardFactory.create(Suit.SPADE, '7');
      const aceCard = CardFactory.create(Suit.HEART, 'A');
      player1.hand.add([sevenCard, aceCard, CardFactory.create(Suit.DIAMOND, 'K')]);
      player2.hand.add([CardFactory.create(Suit.CLUB, '5')]);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.ruleSettings.sevenPass = true;

      const humanStrategy = new HumanStrategy();
      strategyMap.set(player1.id.value, humanStrategy);

      const player2InitialHandSize = player2.hand.size();

      // 7を出す
      setTimeout(() => {
        humanStrategy.submitPlay([sevenCard]);
      }, 10);

      // 7を出した後、7渡しのカード選択が始まる
      setTimeout(() => {
        // Aを渡す
        humanStrategy.submitCardSelection([aceCard]);
      }, 20);

      await playPhase.update(gameState);

      // Aがプレイヤー1から削除され、プレイヤー2に追加されたことを確認
      expect(player1.hand.getCards().some(c => c.id === aceCard.id)).toBe(false);
      expect(player2.hand.getCards().some(c => c.id === aceCard.id)).toBe(true);
      expect(player2.hand.size()).toBe(player2InitialHandSize + 1);
    });
  });

  describe('クイーンボンバー', () => {
    it.skip('指定されたランクのカードのみ選択できる', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.HUMAN);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.HUMAN);

      // プレイヤー1にQを持たせる（クイーンボンバーを発動）
      const queenCard = CardFactory.create(Suit.SPADE, 'Q');
      player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

      // プレイヤー2に6♠と6♥を持たせる
      const sixSpade = CardFactory.create(Suit.SPADE, '6');
      const sixHeart = CardFactory.create(Suit.HEART, '6');
      player2.hand.add([sixSpade, sixHeart, CardFactory.create(Suit.CLUB, '5')]);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.ruleSettings.queenBomber = true;

      const humanStrategy1 = new HumanStrategy();
      const humanStrategy2 = new HumanStrategy();
      strategyMap.set(player1.id.value, humanStrategy1);
      strategyMap.set(player2.id.value, humanStrategy2);

      // プレイヤー1がQを出す
      setTimeout(() => {
        humanStrategy1.submitPlay([queenCard]);
      }, 10);

      // プレイヤー1が6を指定（ランク選択）
      setTimeout(() => {
        humanStrategy1.submitRankSelection('6');
      }, 20);

      // プレイヤー2が6♠を捨てる（6♥でもOK）
      setTimeout(() => {
        humanStrategy2.submitCardSelection([sixSpade]);
      }, 30);

      // プレイヤー1は6を持っていないのでスキップ
      setTimeout(() => {
        humanStrategy1.submitCardSelection([]);
      }, 40);

      await playPhase.update(gameState);

      // 6♠が手札から削除されたことを確認
      expect(player2.hand.getCards().some(c => c.id === sixSpade.id)).toBe(false);
      // 6♥はまだ手札にあることを確認（どちらか一方を捨てればOK）
      expect(player2.hand.getCards().some(c => c.id === sixHeart.id)).toBe(true);
    });

    it.skip('指定されたランクのカードがない場合はスキップできる', async () => {
      const player1 = createPlayer('p1', 'Player 1', PlayerType.HUMAN);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.HUMAN);

      // プレイヤー1にQを持たせる
      const queenCard = CardFactory.create(Suit.SPADE, 'Q');
      player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

      // プレイヤー2には6を持たせない
      player2.hand.add([CardFactory.create(Suit.CLUB, '5'), CardFactory.create(Suit.DIAMOND, '7')]);

      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.ruleSettings.queenBomber = true;

      const humanStrategy1 = new HumanStrategy();
      const humanStrategy2 = new HumanStrategy();
      strategyMap.set(player1.id.value, humanStrategy1);
      strategyMap.set(player2.id.value, humanStrategy2);

      const player2InitialHandSize = player2.hand.size();

      // プレイヤー1がQを出す
      setTimeout(() => {
        humanStrategy1.submitPlay([queenCard]);
      }, 10);

      // プレイヤー1が6を指定（ランク選択）
      setTimeout(() => {
        humanStrategy1.submitRankSelection('6');
      }, 20);

      // プレイヤー2が空配列でスキップ
      setTimeout(() => {
        humanStrategy2.submitCardSelection([]);
      }, 30);

      // プレイヤー1もスキップ
      setTimeout(() => {
        humanStrategy1.submitCardSelection([]);
      }, 40);

      await playPhase.update(gameState);

      // プレイヤー2の手札が変わっていないことを確認
      expect(player2.hand.size()).toBe(player2InitialHandSize);

      // 全員が選択完了したのでクイーンボンバーリクエストがクリアされる
      expect(gameState.cardSelectionRequest).toBeFalsy();
    });
  });
});
