import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, createGameState, GamePhaseType } from '../domain/game/GameState';
import { createPlayer, PlayerType } from '../domain/player/Player';
import { PlayPhase } from '../phase/PlayPhase';
import { RuleEngine } from './base/RuleEngine';
import { CardFactory, Suit } from '../domain/card/Card';
import { DEFAULT_RULE_SETTINGS } from '../domain/game/RuleSettings';
import { GameEventEmitter } from '../domain/events/GameEventEmitter';

describe('クイーンボンバー (Queen Bomber)', () => {
  let gameState: GameState;
  let playPhase: PlayPhase;
  let eventBus: GameEventEmitter;

  beforeEach(() => {
    // 4人のプレイヤーを作成
    const players = [
      createPlayer('player1', 'Player 1', PlayerType.HUMAN),
      createPlayer('player2', 'Player 2', PlayerType.CPU),
      createPlayer('player3', 'Player 3', PlayerType.CPU),
      createPlayer('player4', 'Player 4', PlayerType.CPU),
    ];

    gameState = createGameState(players, {
      ...DEFAULT_RULE_SETTINGS,
      queenBomber: true,
    });
    gameState.phase = GamePhaseType.PLAY;
    gameState.currentPlayerIndex = 0;

    eventBus = {
      emit: () => {}, // モックの実装
    };
    const ruleEngine = new RuleEngine();
    playPhase = new PlayPhase(new Map(), ruleEngine, eventBus);
  });

  it('Qを出すとカード選択リクエストが設定される', () => {
    const player = gameState.players[0];

    // 各プレイヤーに手札を配る
    gameState.players.forEach(p => {
      const card = CardFactory.create(Suit.SPADE, '3');
      p.hand.add([card]);
    });

    // Qを出す
    const cardQ = CardFactory.create(Suit.SPADE, 'Q');
    player.hand.add([cardQ]);
    playPhase['handlePlay'](gameState, player, [cardQ]);

    // カード選択リクエストが設定されているはず
    expect(gameState.cardSelectionRequest).not.toBeNull();
    expect(gameState.cardSelectionRequest?.reason).toBe('queenBomber');
    expect(gameState.cardSelectionRequest?.count).toBe(1);
  });

  it('カードを持っていないプレイヤーがいる場合、スキップされる', () => {
    const player = gameState.players[0];

    // Player 1とPlayer 3だけに手札を配る（Player 2とPlayer 4は手札なし）
    player.hand.add([CardFactory.create(Suit.SPADE, '3')]);
    gameState.players[2].hand.add([CardFactory.create(Suit.HEART, '4')]);

    // Qを出す
    const cardQ = CardFactory.create(Suit.SPADE, 'Q');
    player.hand.add([cardQ]);
    playPhase['handlePlay'](gameState, player, [cardQ]);

    // Player 1から始まる（Qを出したプレイヤー自身）
    expect(gameState.cardSelectionRequest?.playerId).toBe('player1');

    // Player 1が選択
    const card1 = player.hand.getCards()[0];
    playPhase['handleCardSelection'](gameState, 'player1', [card1]);

    // Player 2に移動（手札がない）
    expect(gameState.cardSelectionRequest?.playerId).toBe('player2');

    // Player 2は手札がないが、リクエストは来ている
    // 実装では、手札がない場合はスキップする必要がある
    playPhase['handleCardSelection'](gameState, 'player2', []);

    // Player 3に移動するはず
    expect(gameState.cardSelectionRequest?.playerId).toBe('player3');
  });

  it('全員が手札を持っていない場合、リクエストが設定されない', () => {
    const player = gameState.players[0];

    // 全員の手札をクリア
    gameState.players.forEach(p => {
      p.hand.remove([...p.hand.getCards()]);
    });

    // Qを出す
    const cardQ = CardFactory.create(Suit.SPADE, 'Q');
    player.hand.add([cardQ]);
    playPhase['handlePlay'](gameState, player, [cardQ]);

    // リクエストが設定されていないはず
    expect(gameState.cardSelectionRequest).toBeNull();
  });

  it('全員がカードを捨て終わったらリクエストがクリアされる', () => {
    const player = gameState.players[0];

    // 各プレイヤーに1枚ずつ手札を配る
    gameState.players.forEach((p, i) => {
      const card = CardFactory.create(Suit.SPADE, String(3 + i) as any);
      p.hand.add([card]);
    });

    // Qを出す
    const cardQ = CardFactory.create(Suit.SPADE, 'Q');
    player.hand.add([cardQ]);
    playPhase['handlePlay'](gameState, player, [cardQ]);

    // 各プレイヤーが順番にカードを捨てる
    for (let i = 0; i < gameState.players.length; i++) {
      const currentPlayer = gameState.players.find(p => p.id.value === gameState.cardSelectionRequest?.playerId);
      if (!currentPlayer) break;

      const cards = currentPlayer.hand.getCards();
      if (cards.length > 0) {
        playPhase['handleCardSelection'](gameState, currentPlayer.id.value, [cards[0]]);
      }
    }

    // 全員が捨て終わったのでリクエストがクリアされているはず
    expect(gameState.cardSelectionRequest).toBeNull();
  });

  it('上がっているプレイヤーはスキップされる', () => {
    const player = gameState.players[0];

    // Player 2を上がり状態にする
    gameState.players[1].isFinished = true;
    gameState.players[1].finishPosition = 1;

    // Player 1, 3, 4に手札を配る
    player.hand.add([CardFactory.create(Suit.SPADE, '3')]);
    gameState.players[2].hand.add([CardFactory.create(Suit.HEART, '4')]);
    gameState.players[3].hand.add([CardFactory.create(Suit.DIAMOND, '5')]);

    // Qを出す
    const cardQ = CardFactory.create(Suit.SPADE, 'Q');
    player.hand.add([cardQ]);
    playPhase['handlePlay'](gameState, player, [cardQ]);

    // Player 1から始まる
    expect(gameState.cardSelectionRequest?.playerId).toBe('player1');

    // Player 1が選択
    const card1 = player.hand.getCards()[0];
    playPhase['handleCardSelection'](gameState, 'player1', [card1]);

    // Player 2はスキップされ、Player 3に移動するはず（Player 2は上がっている）
    expect(gameState.cardSelectionRequest?.playerId).toBe('player3');
  });
});
