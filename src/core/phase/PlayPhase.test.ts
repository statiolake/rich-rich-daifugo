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
  });

  describe('11バックの発動', () => {
    it('Jが出されたときに11バックが発動する', () => {
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

      // Jを出す
      playPhase.handlePlaySync(gameState, player1, [jackCard]);

      // 11バックが発動したことを確認
      expect(gameState.isElevenBack).toBe(true);
    });

    it('Jが再度出されたときに11バックが解除される', () => {
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
      playPhase.handlePlaySync(gameState, player1, [jack1]);
      expect(gameState.isElevenBack).toBe(true);

      // 2回目のJ
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [jack2]);
      expect(gameState.isElevenBack).toBe(false);
    });
  });

  describe('11バックのリセット', () => {
    it('場が流れたときに11バックがリセットされる', () => {
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
      playPhase.handlePlaySync(gameState, player1, [jackCard]);
      expect(gameState.isElevenBack).toBe(true);

      // Player2, 3, 4がパス
      playPhase.handlePassSync(gameState, player2); // Player2パス
      playPhase.handlePassSync(gameState, player3); // Player3パス
      playPhase.handlePassSync(gameState, player4); // Player4パス（場が流れる）

      // 11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
    });

    it('新しいラウンド開始時に11バックがリセットされる', () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.isElevenBack = true; // 11バックがactive

      // 新しいラウンド開始
      playPhase.enter(gameState);

      // 11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
    });

    it('8切りで場が流れたときに11バックがリセットされる', () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定（3 → J → 2 → 8 の順で出す）
      // 11バック中は強い方が弱いので、J < 2、2 < 8と出せる
      const threeCard = CardFactory.create(Suit.SPADE, '3');
      const jackCard = CardFactory.create(Suit.HEART, 'J');
      const twoCard = CardFactory.create(Suit.DIAMOND, '2');
      const eightCard = CardFactory.create(Suit.CLUB, '8');
      player1.hand.add([threeCard, jackCard, twoCard, eightCard, CardFactory.create(Suit.SPADE, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '4')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isElevenBack = false;

      // Player1が3を出す
      playPhase.handlePlaySync(gameState, player1, [threeCard]);

      // Player1がJを出して11バック発動
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [jackCard]);
      expect(gameState.isElevenBack).toBe(true);

      // Player1が2を出す（11バック中は2の方が弱いとみなされる）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [twoCard]);

      // Player1が8を出す（11バック中は8の方が弱いとみなされる＆8切り発動）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [eightCard]);

      // 8切りで場が流れて11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
      expect(gameState.field.isEmpty()).toBe(true);
    });

    it('救急車（9x2）で場が流れたときに11バックがリセットされる', () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定（3 → J → Q,Q → 9,9 の順で出す）
      // 11バック中は強い方が弱いので出せる
      const threeCard = CardFactory.create(Suit.SPADE, '3');
      const jackCard = CardFactory.create(Suit.HEART, 'J');
      const queen1 = CardFactory.create(Suit.DIAMOND, 'Q');
      const queen2 = CardFactory.create(Suit.CLUB, 'Q');
      const nine1 = CardFactory.create(Suit.SPADE, '9');
      const nine2 = CardFactory.create(Suit.HEART, '9');
      player1.hand.add([threeCard, jackCard, queen1, queen2, nine1, nine2]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '4')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isElevenBack = false;

      // Player1が3を出す
      playPhase.handlePlaySync(gameState, player1, [threeCard]);

      // Player1がJを出して11バック発動
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [jackCard]);
      expect(gameState.isElevenBack).toBe(true);

      // Player1がQ,Qを出す（11バック中は弱いとみなされる）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [queen1, queen2]);

      // Player1が9,9（救急車）を出す（11バック中は弱いとみなされる）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [nine1, nine2]);

      // 救急車で場が流れて11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
      expect(gameState.field.isEmpty()).toBe(true);
    });

    it('ろくろ首（6x2）で場が流れたときに11バックがリセットされる', () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定（3 → J → 9,9 → 6,6 の順で出す）
      // 11バック中は強い方が弱いので出せる
      const threeCard = CardFactory.create(Suit.SPADE, '3');
      const jackCard = CardFactory.create(Suit.HEART, 'J');
      const nine1 = CardFactory.create(Suit.DIAMOND, '9');
      const nine2 = CardFactory.create(Suit.CLUB, '9');
      const six1 = CardFactory.create(Suit.SPADE, '6');
      const six2 = CardFactory.create(Suit.HEART, '6');
      player1.hand.add([threeCard, jackCard, nine1, nine2, six1, six2]);
      player2.hand.add([CardFactory.create(Suit.DIAMOND, '4')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isElevenBack = false;

      // Player1が3を出す
      playPhase.handlePlaySync(gameState, player1, [threeCard]);

      // Player1がJを出して11バック発動
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [jackCard]);
      expect(gameState.isElevenBack).toBe(true);

      // Player1が9,9を出す（11バック中は弱いとみなされる）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [nine1, nine2]);

      // Player1が6,6（ろくろ首）を出す（11バック中は弱いとみなされる）
      gameState.currentPlayerIndex = 0;
      playPhase.handlePlaySync(gameState, player1, [six1, six2]);

      // ろくろ首で場が流れて11バックがリセットされたことを確認
      expect(gameState.isElevenBack).toBe(false);
      expect(gameState.field.isEmpty()).toBe(true);
    });
  });

  describe('革命との組み合わせ', () => {
    it('革命中にJを出すと両方activeになる（XORで通常に戻る）', () => {
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
      playPhase.handlePlaySync(gameState, player1, [jackCard]);

      // 両方がtrueになっている
      expect(gameState.isRevolution).toBe(true);
      expect(gameState.isElevenBack).toBe(true);

      // XORロジック: true !== true = false（通常の強さ判定に戻る）
      const rev = gameState.isRevolution as boolean;
      const eb = gameState.isElevenBack as boolean;
      const shouldReverse = rev !== eb;
      expect(shouldReverse).toBe(false);
    });

    it('JJJJ（4枚出し）で革命と11バックが両方発動する', () => {
      // プレイヤー作成
      const player1 = createPlayer('p1', 'Player 1', PlayerType.CPU);
      const player2 = createPlayer('p2', 'Player 2', PlayerType.CPU);

      // 手札設定
      const jack1 = CardFactory.create(Suit.SPADE, 'J');
      const jack2 = CardFactory.create(Suit.HEART, 'J');
      const jack3 = CardFactory.create(Suit.DIAMOND, 'J');
      const jack4 = CardFactory.create(Suit.CLUB, 'J');
      player1.hand.add([jack1, jack2, jack3, jack4, CardFactory.create(Suit.SPADE, 'Q')]);
      player2.hand.add([CardFactory.create(Suit.HEART, '3')]);

      // ゲーム状態作成
      const gameState = createGameState([player1, player2]);
      gameState.phase = GamePhaseType.PLAY;
      gameState.currentPlayerIndex = 0;
      gameState.isRevolution = false;
      gameState.isElevenBack = false;

      // JJJJ（4枚）を出す
      playPhase.handlePlaySync(gameState, player1, [jack1, jack2, jack3, jack4]);

      // 革命と11バックの両方が発動している
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
