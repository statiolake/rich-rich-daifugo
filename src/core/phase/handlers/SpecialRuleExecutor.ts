import { GameState } from '../../domain/game/GameState';
import { Player } from '../../domain/player/Player';
import { Card } from '../../domain/card/Card';
import { PlayerStrategy } from '../../strategy/PlayerStrategy';
import { GameEventEmitter } from '../../domain/events/GameEventEmitter';

/**
 * 特殊ルール実行ハンドラー
 *
 * 7渡し、10捨て、クイーンボンバーなどの特殊ルールの実行を担当する。
 * これらのルールはプレイ後に追加のカード選択アクションを要求する。
 */
export class SpecialRuleExecutor {
  private waitForCutInFn?: () => Promise<void>;

  constructor(
    private strategyMap: Map<string, PlayerStrategy>,
    private eventBus?: GameEventEmitter
  ) {}

  setWaitForCutIn(fn: () => Promise<void>): void {
    this.waitForCutInFn = fn;
  }

  /**
   * 7渡しを処理する
   */
  async executeSevenPass(
    gameState: GameState,
    player: Player,
    onPlayerFinish: (gameState: GameState, player: Player) => void
  ): Promise<void> {
    // 次のプレイヤーを探す
    const direction = gameState.isReversed ? -1 : 1;
    const nextIndex = (gameState.currentPlayerIndex + direction + gameState.players.length) % gameState.players.length;
    let nextPlayer = gameState.players[nextIndex];

    // 上がっていないプレイヤーを探す
    let searchIndex = nextIndex;
    let attempts = 0;
    while (nextPlayer.isFinished && attempts < gameState.players.length) {
      searchIndex = (searchIndex + direction + gameState.players.length) % gameState.players.length;
      nextPlayer = gameState.players[searchIndex];
      attempts++;
    }

    if (!nextPlayer.isFinished) {
      // イベント発火とカットイン待機
      this.eventBus?.emit('sevenPass:triggered', {
        fromPlayer: player.name,
        toPlayer: nextPlayer.name
      });

      if (this.waitForCutInFn) {
        await this.waitForCutInFn();
      }

      // Validator: 任意のカード1枚
      const validator = (cards: Card[]) => {
        if (cards.length === 1) {
          return { valid: true };
        }
        return { valid: false, reason: '1枚選んでください' };
      };

      const strategy = this.strategyMap.get(player.id);
      if (!strategy) return;

      const selectedCards = await strategy.selectCards(player, validator, {
        message: `7渡し：${nextPlayer.name}に渡すカードを1枚選んでください`
      });

      if (selectedCards.length === 1) {
        player.hand.remove(selectedCards);
        nextPlayer.hand.add(selectedCards);
        console.log(`7渡し：${player.name}が${nextPlayer.name}に${selectedCards[0].rank}${selectedCards[0].suit}を渡しました`);

        // カードを渡した結果、手札がゼロになったら勝利判定
        if (player.hand.isEmpty() && !player.isFinished) {
          onPlayerFinish(gameState, player);
        }
      }
    }
  }

  /**
   * 10捨てを処理する
   */
  async executeTenDiscard(
    gameState: GameState,
    player: Player,
    onPlayerFinish: (gameState: GameState, player: Player) => void
  ): Promise<void> {
    // イベント発火とカットイン待機
    this.eventBus?.emit('tenDiscard:triggered', {
      player: player.name
    });

    if (this.waitForCutInFn) {
      await this.waitForCutInFn();
    }

    // Validator: 任意のカード1枚
    const validator = (cards: Card[]) => {
      if (cards.length === 1) {
        return { valid: true };
      }
      return { valid: false, reason: '1枚選んでください' };
    };

    const strategy = this.strategyMap.get(player.id);
    if (!strategy) return;

    const selectedCards = await strategy.selectCards(player, validator, {
      message: '10捨て：捨てるカードを1枚選んでください'
    });

    if (selectedCards.length === 1) {
      player.hand.remove(selectedCards);
      console.log(`10捨て：${player.name}が${selectedCards[0].rank}${selectedCards[0].suit}を捨てました`);

      // カードを捨てた結果、手札がゼロになったら勝利判定
      if (player.hand.isEmpty() && !player.isFinished) {
        onPlayerFinish(gameState, player);
      }
    }
  }

  /**
   * クイーンボンバーを処理する
   */
  async executeQueenBomber(
    gameState: GameState,
    player: Player,
    onPlayerFinish: (gameState: GameState, player: Player) => void
  ): Promise<void> {
    console.log('クイーンボンバー発動！カードを選んでください');

    // イベント発火とカットイン待機
    this.eventBus?.emit('queenBomber:triggered', {});

    if (this.waitForCutInFn) {
      await this.waitForCutInFn();
    }

    // 発動プレイヤーがランクを選択
    const strategy = this.strategyMap.get(player.id);
    if (!strategy) return;

    const selectedRank = await strategy.selectRank(player);
    console.log(`クイーンボンバー：${selectedRank}が指定されました`);

    // 全プレイヤーが順番にカードを捨てる
    const startIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    for (let i = 0; i < gameState.players.length; i++) {
      const playerIndex = (startIndex + i) % gameState.players.length;
      const currentPlayer = gameState.players[playerIndex];

      if (currentPlayer.isFinished || currentPlayer.hand.isEmpty()) {
        continue;
      }

      const playerStrategy = this.strategyMap.get(currentPlayer.id);
      if (!playerStrategy) continue;

      // Validator: 指定ランクのカード1枚、またはスキップ（空配列）
      const validator = (cards: Card[]) => {
        if (cards.length === 0) {
          return { valid: true }; // スキップ
        }
        if (cards.length === 1 && cards[0].rank === selectedRank) {
          return { valid: true };
        }
        return { valid: false, reason: `${selectedRank}を1枚選んでください` };
      };

      const selectedCards = await playerStrategy.selectCards(currentPlayer, validator, {
        message: `クイーンボンバー：${selectedRank}を捨ててください`,
        specifiedRank: selectedRank
      });

      if (selectedCards.length > 0) {
        currentPlayer.hand.remove(selectedCards);
        console.log(`クイーンボンバー：${currentPlayer.name}が${selectedCards[0].rank}を捨てました`);

        // カードを捨てた結果、手札がゼロになったら勝利判定
        if (currentPlayer.hand.isEmpty() && !currentPlayer.isFinished) {
          onPlayerFinish(gameState, currentPlayer);
        }
      } else {
        console.log(`クイーンボンバー：${currentPlayer.name}は${selectedRank}を持っていないのでスキップ`);
      }
    }
  }
}
