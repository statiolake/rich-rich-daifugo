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

describe('クイーンボンバー (Queen Bomber)', () => {
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

  it('Qx3を出すと全プレイヤーが指定ランクのカードを最大3枚捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.CPU);

    // 各プレイヤーに手札を配る
    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
      CardFactory.create(Suit.DIAMOND, 'Q'),
    ];
    player1.hand.add([...queenCards, CardFactory.create(Suit.HEART, 'K')]);

    const threeSpade = CardFactory.create(Suit.SPADE, '3');
    player2.hand.add([threeSpade, CardFactory.create(Suit.CLUB, '4')]);

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

    // Player 1がQx3を出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextCardChoice([]); // Player 1は3を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2が3を1枚捨てる（手札に1枚しかない）
    const controller2 = new MockPlayerController();
    controller2.setNextCardChoice([threeSpade]);
    playerControllers.set('player2', controller2);

    // Player 3が3を1枚捨てる（手札に1枚しかない）
    const controller3 = new MockPlayerController();
    controller3.setNextCardChoice([threeHeart]);
    playerControllers.set('player3', controller3);

    // Player 4が3を1枚捨てる（手札に1枚しかない）
    const controller4 = new MockPlayerController();
    controller4.setNextCardChoice([threeClub]);
    playerControllers.set('player4', controller4);

    await playPhase.update(gameState);

    // 各プレイヤーの3が削除されたことを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade.id)).toBe(false);
    expect(player3.hand.getCards().some(c => c.id === threeHeart.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 1は3を持っていないので手札は変わらない（Qx3を出したので3枚減る）
    expect(player1.hand.size()).toBe(1);

    // クイーンボンバーのカットインが表示されたことを確認
    expect(presentationRequester.hasEffect('クイーンボンバー')).toBe(true);
  });

  it('カードを持っていないプレイヤーはパスする（手番は回る）', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.CPU);

    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
      CardFactory.create(Suit.DIAMOND, 'Q'),
    ];
    player1.hand.add([...queenCards, CardFactory.create(Suit.HEART, 'K')]);

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

    const player3InitialHandSize = player3.hand.size();

    // Player 1がQx3を出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextCardChoice([]); // Player 1は3を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2が3を捨てる
    const controller2 = new MockPlayerController();
    controller2.setNextCardChoice([threeSpade]);
    playerControllers.set('player2', controller2);

    // Player 3は3を持っていないのでパス（手番は回る）
    const controller3 = new MockPlayerController();
    controller3.setNextCardChoice([]);
    playerControllers.set('player3', controller3);

    // Player 4が3を捨てる
    const controller4 = new MockPlayerController();
    controller4.setNextCardChoice([threeClub]);
    playerControllers.set('player4', controller4);

    await playPhase.update(gameState);

    // Player 2とPlayer 4の3が削除されたことを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 3の手札は変わっていないことを確認
    expect(player3.hand.size()).toBe(player3InitialHandSize);
  });

  it('上がっているプレイヤーはスキップされる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);
    const player4 = createPlayer('player4', 'Player 4', PlayerType.CPU);

    // Player 2を上がり状態にする
    player2.isFinished = true;
    player2.finishPosition = 1;

    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
      CardFactory.create(Suit.DIAMOND, 'Q'),
    ];
    player1.hand.add([...queenCards, CardFactory.create(Suit.HEART, 'K')]);

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

    // Player 1がQx3を出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextCardChoice([]); // Player 1は3を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2はスキップされる（上がっているので、controller の呼び出しもない）

    // Player 3が3を捨てる
    const controller3 = new MockPlayerController();
    controller3.setNextCardChoice([threeSpade]);
    playerControllers.set('player3', controller3);

    // Player 4が3を捨てる
    const controller4 = new MockPlayerController();
    controller4.setNextCardChoice([threeClub]);
    playerControllers.set('player4', controller4);

    await playPhase.update(gameState);

    // Player 3とPlayer 4の3が削除されたことを確認
    expect(player3.hand.getCards().some(c => c.id === threeSpade.id)).toBe(false);
    expect(player4.hand.getCards().some(c => c.id === threeClub.id)).toBe(false);

    // Player 2は上がっているので手札はそのまま（実際は空）
    expect(player2.isFinished).toBe(true);
  });

  it('複数のランクのカードを持っている場合、指定されたランクのみ捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
      CardFactory.create(Suit.DIAMOND, 'Q'),
    ];
    player1.hand.add([...queenCards, CardFactory.create(Suit.HEART, 'K')]);

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

    // Player 1がQx3を出して、4を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('4');
    controller1.setNextCardChoice([]); // Player 1は4を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2が4を1枚捨てる（手札に1枚しかない、ターゲット数は3だがmin(1,3)=1）
    const controller2 = new MockPlayerController();
    controller2.setNextCardChoice([fourSpade]);
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // 4だけが削除され、3と5は残っていることを確認
    expect(player2.hand.getCards().some(c => c.id === threeSpade.id)).toBe(true);
    expect(player2.hand.getCards().some(c => c.id === fourSpade.id)).toBe(false);
    expect(player2.hand.getCards().some(c => c.id === fiveSpade.id)).toBe(true);
    expect(player2.hand.size()).toBe(2);
  });

  it('Qx2を出すと各プレイヤーは最大2枚まで捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    // Player 1がQx2を出す
    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
    ];
    player1.hand.add([...queenCards, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を4枚持っている
    const threes = [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
      CardFactory.create(Suit.DIAMOND, '3'),
      CardFactory.create(Suit.CLUB, '3'),
    ];
    player2.hand.add([...threes, CardFactory.create(Suit.SPADE, '5')]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQx2を出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextCardChoice([]); // Player 1は3を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2は3を2枚だけ捨てる（min(4, 2) = 2）
    const controller2 = new MockPlayerController();
    controller2.setNextCardChoice([threes[0], threes[1]]);
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // 2枚だけ削除され、残り2枚は残っていることを確認
    expect(player2.hand.getCards().filter(c => c.rank === '3').length).toBe(2);
    expect(player2.hand.size()).toBe(3); // 3が2枚残り + 5が1枚
  });

  it('Qx1を出すと各プレイヤーは最大1枚まで捨てる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    // Player 1がQx1を出す（単独Q）
    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    player1.hand.add([queenCard, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を3枚持っている
    const threes = [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
      CardFactory.create(Suit.DIAMOND, '3'),
    ];
    player2.hand.add([...threes, CardFactory.create(Suit.SPADE, '5')]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQx1を出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice([queenCard]);
    controller1.setNextRankChoice('3');
    controller1.setNextCardChoice([]); // Player 1は3を持っていないのでパス
    playerControllers.set('player1', controller1);

    // Player 2は3を1枚だけ捨てる（min(3, 1) = 1）
    const controller2 = new MockPlayerController();
    controller2.setNextCardChoice([threes[0]]);
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // 1枚だけ削除され、残り2枚は残っていることを確認
    expect(player2.hand.getCards().filter(c => c.rank === '3').length).toBe(2);
    expect(player2.hand.size()).toBe(3); // 3が2枚残り + 5が1枚
  });
});
