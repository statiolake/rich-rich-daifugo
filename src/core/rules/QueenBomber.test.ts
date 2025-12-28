import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, createGameState, GamePhaseType } from '../domain/game/GameState';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { PlayPhase } from '../phase/PlayPhase';
import { RuleEngine } from './base/RuleEngine';
import { CardFactory, Suit } from '../domain/card/Card';
import { DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';
import { HumanStrategy } from '../strategy/HumanStrategy';

describe('クイーンボンバー (Queen Bomber)', () => {
  let playPhase: PlayPhase;
  let strategyMap: Map<string, any>;
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    strategyMap = new Map();
    playPhase = new PlayPhase(strategyMap, ruleEngine);
  });

  it.skip('Qを出すと全プレイヤーがカードを捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.HUMAN);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.HUMAN);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.HUMAN);

    // 各プレイヤーに手札を配る
    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

    const threeSpade1 = CardFactory.create(Suit.SPADE, '3');
    player2.hand.add([threeSpade1, CardFactory.create(Suit.CLUB, '4')]);

    const threeHeart = CardFactory.create(Suit.HEART, '3');
    player3.hand.add([threeHeart, CardFactory.create(Suit.DIAMOND, '5')]);

    const threeClub = CardFactory.create(Suit.CLUB, '3');
    player4.hand.add([threeClub, CardFactory.create(Suit.SPADE, '6')]);

    const gameState = createGameState([player1, player2, player3, player4], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    const humanStrategy1 = new HumanStrategy();
    const humanStrategy2 = new HumanStrategy();
    const humanStrategy3 = new HumanStrategy();
    const humanStrategy4 = new HumanStrategy();
    strategyMap.set(player1.id.value, humanStrategy1);
    strategyMap.set(player2.id.value, humanStrategy2);
    strategyMap.set(player3.id.value, humanStrategy3);
    strategyMap.set(player4.id.value, humanStrategy4);

    // Player 1がQを出す
    setTimeout(() => {
      humanStrategy1.submitPlay([queenCard]);
    }, 10);

    // Player 1が3を指定
    setTimeout(() => {
      humanStrategy1.submitRankSelection('3');
    }, 20);

    // Player 2が3を捨てる
    setTimeout(() => {
      humanStrategy2.submitCardSelection([threeSpade1]);
    }, 30);

    // Player 3が3を捨てる
    setTimeout(() => {
      humanStrategy3.submitCardSelection([threeHeart]);
    }, 40);

    // Player 4が3を捨てる
    setTimeout(() => {
      humanStrategy4.submitCardSelection([threeClub]);
    }, 50);

    // Player 1は3を持っていないのでスキップ
    setTimeout(() => {
      humanStrategy1.submitCardSelection([]);
    }, 60);

    await playPhase.update(gameState);

    // 各プレイヤーの3が削除されたことを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade1.id)).toBe(false);
    expect(player3.hand.getCards().some(c => c.id === threeHeart.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 1は3を持っていないので手札は変わらない（Qを出したので1枚減る）
    expect(player1.hand.size()).toBe(1);
  });

  it.skip('カードを持っていないプレイヤーはスキップできる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.HUMAN);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.HUMAN);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.HUMAN);

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2とPlayer 4だけに3を持たせる
    const threeSpade = CardFactory.create(Suit.SPADE, '3');
    player2.hand.add([threeSpade, CardFactory.create(Suit.CLUB, '4')]);
    player3.hand.add([CardFactory.create(Suit.DIAMOND, '5')]);

    const threeClub = CardFactory.create(Suit.CLUB, '3');
    player4.hand.add([threeClub, CardFactory.create(Suit.SPADE, '6')]);

    const gameState = createGameState([player1, player2, player3, player4], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    const humanStrategy1 = new HumanStrategy();
    const humanStrategy2 = new HumanStrategy();
    const humanStrategy3 = new HumanStrategy();
    const humanStrategy4 = new HumanStrategy();
    strategyMap.set(player1.id.value, humanStrategy1);
    strategyMap.set(player2.id.value, humanStrategy2);
    strategyMap.set(player3.id.value, humanStrategy3);
    strategyMap.set(player4.id.value, humanStrategy4);

    const player3InitialHandSize = player3.hand.size();

    // Player 1がQを出す
    setTimeout(() => {
      humanStrategy1.submitPlay([queenCard]);
    }, 10);

    // Player 1が3を指定
    setTimeout(() => {
      humanStrategy1.submitRankSelection('3');
    }, 20);

    // Player 2が3を捨てる
    setTimeout(() => {
      humanStrategy2.submitCardSelection([threeSpade]);
    }, 30);

    // Player 3は3を持っていないのでスキップ
    setTimeout(() => {
      humanStrategy3.submitCardSelection([]);
    }, 40);

    // Player 4が3を捨てる
    setTimeout(() => {
      humanStrategy4.submitCardSelection([threeClub]);
    }, 50);

    // Player 1は3を持っていないのでスキップ
    setTimeout(() => {
      humanStrategy1.submitCardSelection([]);
    }, 60);

    await playPhase.update(gameState);

    // Player 2とPlayer 4の3が削除されたことを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 3の手札は変わっていないことを確認
    expect(player3.hand.size()).toBe(player3InitialHandSize);
  });

  it.skip('全員が手札を持っていない場合でも動作する', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.HUMAN);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.HUMAN);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.HUMAN);

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard]);
    // 他のプレイヤーには手札なし

    const gameState = createGameState([player1, player2, player3, player4], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    const humanStrategy1 = new HumanStrategy();
    const humanStrategy2 = new HumanStrategy();
    const humanStrategy3 = new HumanStrategy();
    const humanStrategy4 = new HumanStrategy();
    strategyMap.set(player1.id.value, humanStrategy1);
    strategyMap.set(player2.id.value, humanStrategy2);
    strategyMap.set(player3.id.value, humanStrategy3);
    strategyMap.set(player4.id.value, humanStrategy4);

    // Player 1がQを出す
    setTimeout(() => {
      humanStrategy1.submitPlay([queenCard]);
    }, 10);

    // Player 1が3を指定（誰も持っていない）
    setTimeout(() => {
      humanStrategy1.submitRankSelection('3');
    }, 20);

    // 全員スキップ
    setTimeout(() => {
      humanStrategy2.submitCardSelection([]);
    }, 30);

    setTimeout(() => {
      humanStrategy3.submitCardSelection([]);
    }, 40);

    setTimeout(() => {
      humanStrategy4.submitCardSelection([]);
    }, 50);

    setTimeout(() => {
      humanStrategy1.submitCardSelection([]);
    }, 60);

    await playPhase.update(gameState);

    // Player 1のQが削除されたことを確認
    expect(player1.hand.getCards().some(c => c.id === queenCard.id)).toBe(false);
    expect(player1.hand.size()).toBe(0);
  });

  it.skip('上がっているプレイヤーはスキップされる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.HUMAN);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.HUMAN);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.HUMAN);

    // Player 2を上がり状態にする
    player2.isFinished = true;
    player2.finishPosition = 1;

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

    const threeSpade = CardFactory.create(Suit.SPADE, '3');
    player3.hand.add([threeSpade, CardFactory.create(Suit.DIAMOND, '5')]);

    const threeClub = CardFactory.create(Suit.CLUB, '3');
    player4.hand.add([threeClub, CardFactory.create(Suit.SPADE, '6')]);

    const gameState = createGameState([player1, player2, player3, player4], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    const humanStrategy1 = new HumanStrategy();
    const humanStrategy3 = new HumanStrategy();
    const humanStrategy4 = new HumanStrategy();
    strategyMap.set(player1.id.value, humanStrategy1);
    strategyMap.set(player3.id.value, humanStrategy3);
    strategyMap.set(player4.id.value, humanStrategy4);

    // Player 1がQを出す
    setTimeout(() => {
      humanStrategy1.submitPlay([queenCard]);
    }, 10);

    // Player 1が3を指定
    setTimeout(() => {
      humanStrategy1.submitRankSelection('3');
    }, 20);

    // Player 2はスキップされる（上がっているので、strategy の呼び出しもない）

    // Player 3が3を捨てる
    setTimeout(() => {
      humanStrategy3.submitCardSelection([threeSpade]);
    }, 30);

    // Player 4が3を捨てる
    setTimeout(() => {
      humanStrategy4.submitCardSelection([threeClub]);
    }, 40);

    // Player 1は3を持っていないのでスキップ
    setTimeout(() => {
      humanStrategy1.submitCardSelection([]);
    }, 50);

    await playPhase.update(gameState);

    // Player 3とPlayer 4の3が削除されたことを確認
    expect(player3.hand.getCards().some(c => c.id === threeSpade.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 2は上がっているので手札はそのまま（実際は空）
    expect(player2.isFinished).toBe(true);
  });

  it.skip('複数のランクのカードを持っている場合、指定されたランクのみ捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.HUMAN);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.HUMAN);

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

    const threeSpade = CardFactory.create(Suit.SPADE, '3');
    const fourSpade = CardFactory.create(Suit.SPADE, '4');
    const fiveSpade = CardFactory.create(Suit.SPADE, '5');
    player2.hand.add([threeSpade, fourSpade, fiveSpade]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    const humanStrategy1 = new HumanStrategy();
    const humanStrategy2 = new HumanStrategy();
    strategyMap.set(player1.id.value, humanStrategy1);
    strategyMap.set(player2.id.value, humanStrategy2);

    // Player 1がQを出す
    setTimeout(() => {
      humanStrategy1.submitPlay([queenCard]);
    }, 10);

    // Player 1が4を指定
    setTimeout(() => {
      humanStrategy1.submitRankSelection('4');
    }, 20);

    // Player 2が4を捨てる
    setTimeout(() => {
      humanStrategy2.submitCardSelection([fourSpade]);
    }, 30);

    // Player 1は4を持っていないのでスキップ
    setTimeout(() => {
      humanStrategy1.submitCardSelection([]);
    }, 40);

    await playPhase.update(gameState);

    // 4だけが削除され、3と5は残っていることを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade.id)).toBe(true);
    expect(player2.hand.getCards().some(c => c.id === fourSpade.id)).toBe(false);
    expect(player2.hand.getCards().some(c => c.id === fiveSpade.id)).toBe(true);
    expect(player2.hand.size()).toBe(2);
  });
});
