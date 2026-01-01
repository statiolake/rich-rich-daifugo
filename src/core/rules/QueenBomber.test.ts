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
import { handSize, handIsEmpty, handGetCards, handAdd } from '../domain/card/Hand';

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

  it('Qx1を出すと指定ランクのカードが全プレイヤーからすべて捨てられる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);

    // Player 1がQを1枚出す
    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    handAdd(player1.hand, [queenCard, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を3枚持っている
    const threes2 = [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
      CardFactory.create(Suit.DIAMOND, '3'),
    ];
    handAdd(player2.hand, [...threes2, CardFactory.create(Suit.CLUB, '5')]);

    // Player 3は3を1枚持っている
    const three3 = CardFactory.create(Suit.CLUB, '3');
    handAdd(player3.hand, [three3, CardFactory.create(Suit.SPADE, '6')]);

    const gameState = createGameState([player1, player2, player3], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQを出して、3を指定（Q1枚で1つのランク選択）
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice([queenCard]);
    controller1.setNextRankChoice('3');
    playerControllers.set('player1', controller1);

    // Player 2, 3には選択が不要（自動で捨てられる）
    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    const controller3 = new MockPlayerController();
    playerControllers.set('player3', controller3);

    await playPhase.update(gameState);

    // Player 2の3がすべて削除されたことを確認
    expect(handGetCards(player2.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handSize(player2.hand)).toBe(1); // 5が1枚残り

    // Player 3の3がすべて削除されたことを確認
    expect(handGetCards(player3.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handSize(player3.hand)).toBe(1); // 6が1枚残り

    // クイーンボンバーのカットインが表示されたことを確認
    expect(presentationRequester.hasEffect('クイーンボンバー')).toBe(true);
  });

  it('Qx2を出すと2つのランクを指定でき、両方のランクのカードがすべて捨てられる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    // Player 1がQx2を出す
    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
    ];
    handAdd(player1.hand, [...queenCards, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を2枚、4を2枚持っている
    const threes = [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
    ];
    const fours = [
      CardFactory.create(Suit.SPADE, '4'),
      CardFactory.create(Suit.HEART, '4'),
    ];
    handAdd(player2.hand, [...threes, ...fours, CardFactory.create(Suit.SPADE, '5')]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQx2を出して、3と4を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3'); // 1回目
    controller1.setNextRankChoice('4'); // 2回目
    playerControllers.set('player1', controller1);

    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // Player 2の3と4がすべて削除されたことを確認
    expect(handGetCards(player2.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handGetCards(player2.hand).filter(c => c.rank === '4').length).toBe(0);
    expect(handSize(player2.hand)).toBe(1); // 5が1枚残り
  });

  it('Qx3を出すと3つのランクを指定でき、すべてのランクのカードがすべて捨てられる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    // Player 1がQx3を出す
    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
      CardFactory.create(Suit.DIAMOND, 'Q'),
    ];
    handAdd(player1.hand, [...queenCards, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3, 4, 5をそれぞれ複数枚持っている
    handAdd(player2.hand, [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
      CardFactory.create(Suit.SPADE, '4'),
      CardFactory.create(Suit.SPADE, '5'),
      CardFactory.create(Suit.HEART, '5'),
      CardFactory.create(Suit.SPADE, '6'), // これは残る
    ]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
      jeanneDArc: false,  // ジャンヌダルクを無効化
      bloodyMary: false,  // ブラッディメアリを無効化
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQx3を出して、3, 4, 5を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextRankChoice('4');
    controller1.setNextRankChoice('5');
    playerControllers.set('player1', controller1);

    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // Player 2の3, 4, 5がすべて削除されたことを確認
    expect(handGetCards(player2.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handGetCards(player2.hand).filter(c => c.rank === '4').length).toBe(0);
    expect(handGetCards(player2.hand).filter(c => c.rank === '5').length).toBe(0);
    expect(handSize(player2.hand)).toBe(1); // 6が1枚残り
  });

  it('同じランクを複数回指定しても効果は1回分', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    // Player 1がQx2を出す
    const queenCards = [
      CardFactory.create(Suit.SPADE, 'Q'),
      CardFactory.create(Suit.HEART, 'Q'),
    ];
    handAdd(player1.hand, [...queenCards, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を2枚持っている
    handAdd(player2.hand, [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
      CardFactory.create(Suit.SPADE, '5'),
    ]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQx2を出して、3を2回指定（同じランク）
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice(queenCards);
    controller1.setNextRankChoice('3');
    controller1.setNextRankChoice('3'); // 同じランクを再度指定
    playerControllers.set('player1', controller1);

    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // Player 2の3がすべて削除されたことを確認（2回指定しても効果は同じ）
    expect(handGetCards(player2.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handSize(player2.hand)).toBe(1); // 5が1枚残り
  });

  it('上がっているプレイヤーはスキップされる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);

    // Player 2を上がり状態にする
    player2.isFinished = true;
    player2.finishPosition = 1;
    handAdd(player2.hand, [CardFactory.create(Suit.SPADE, '3')]); // 仮に手札があったとしても

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    handAdd(player1.hand, [queenCard, CardFactory.create(Suit.HEART, 'K')]);

    const three3 = CardFactory.create(Suit.CLUB, '3');
    handAdd(player3.hand, [three3, CardFactory.create(Suit.SPADE, '6')]);

    const gameState = createGameState([player1, player2, player3], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQを出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice([queenCard]);
    controller1.setNextRankChoice('3');
    playerControllers.set('player1', controller1);

    const controller3 = new MockPlayerController();
    playerControllers.set('player3', controller3);

    await playPhase.update(gameState);

    // Player 3の3が削除されたことを確認
    expect(handGetCards(player3.hand).filter(c => c.rank === '3').length).toBe(0);

    // Player 2は上がっているので手札はそのまま（スキップされた）
    expect(player2.isFinished).toBe(true);
    expect(handSize(player2.hand)).toBe(1); // 変更なし
  });

  it('指定ランクを持っていないプレイヤーは何も捨てない', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);
    const player3 = createPlayer('player3', 'Player 3', PlayerType.CPU);

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    handAdd(player1.hand, [queenCard, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3を持っている
    handAdd(player2.hand, [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.CLUB, '5'),
    ]);

    // Player 3は3を持っていない
    handAdd(player3.hand, [
      CardFactory.create(Suit.SPADE, '4'),
      CardFactory.create(Suit.SPADE, '6'),
    ]);

    const gameState = createGameState([player1, player2, player3], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQを出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice([queenCard]);
    controller1.setNextRankChoice('3');
    playerControllers.set('player1', controller1);

    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    const controller3 = new MockPlayerController();
    playerControllers.set('player3', controller3);

    const player3InitialHandSize = handSize(player3.hand);

    await playPhase.update(gameState);

    // Player 2の3が削除された
    expect(handGetCards(player2.hand).filter(c => c.rank === '3').length).toBe(0);
    expect(handSize(player2.hand)).toBe(1);

    // Player 3は3を持っていないので手札は変わらない
    expect(handSize(player3.hand)).toBe(player3InitialHandSize);
  });

  it('クイーンボンバーで手札がなくなるとプレイヤーが上がる', async () => {
    const player1 = createPlayer('player1', 'Player 1', PlayerType.CPU);
    const player2 = createPlayer('player2', 'Player 2', PlayerType.CPU);

    const queenCard = CardFactory.create(Suit.SPADE, 'Q');
    handAdd(player1.hand, [queenCard, CardFactory.create(Suit.HEART, 'K')]);

    // Player 2は3だけを持っている（クイーンボンバーで上がり）
    handAdd(player2.hand, [
      CardFactory.create(Suit.SPADE, '3'),
      CardFactory.create(Suit.HEART, '3'),
    ]);

    const gameState = createGameState([player1, player2], {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    // Player 1がQを出して、3を指定
    const controller1 = new MockPlayerController();
    controller1.setNextCardChoice([queenCard]);
    controller1.setNextRankChoice('3');
    playerControllers.set('player1', controller1);

    const controller2 = new MockPlayerController();
    playerControllers.set('player2', controller2);

    await playPhase.update(gameState);

    // Player 2が上がったことを確認
    expect(player2.isFinished).toBe(true);
    expect(handIsEmpty(player2.hand)).toBe(true);
  });
});
