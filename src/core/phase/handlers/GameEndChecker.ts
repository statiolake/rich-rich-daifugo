import { GameState, GamePhaseType } from '../../domain/game/GameState';
import { Player } from '../../domain/player/Player';
import { RuleEngine } from '../../rules/base/RuleEngine';
import { PlayerRank } from '../../domain/player/PlayerRank';
import { handSize, handGetCards } from '../../domain/card/Hand';

/**
 * ゲーム終了チェッカー
 *
 * ゲーム終了条件の判定と、終了時の処理（ランク割り当てなど）を担当する。
 * - checkGameEnd: 残りプレイヤー数によるゲーム終了判定
 * - canAnyonePlay: 誰もプレイできない状況の検出
 * - endGameDueToNoPlays: 誰もプレイできない場合の終了処理
 */
export class GameEndChecker {
  constructor(private ruleEngine: RuleEngine) {}

  /**
   * ゲーム終了判定
   * 残りプレイヤーが1人以下になったら終了
   */
  checkGameEnd(
    gameState: GameState,
    onPlayerFinish: (gameState: GameState, player: Player) => void
  ): GamePhaseType | null {
    const remainingPlayers = gameState.players.filter(p => !p.isFinished).length;

    if (remainingPlayers <= 1) {
      // 最後のプレイヤーに最下位を割り当て
      const lastPlayer = gameState.players.find(p => !p.isFinished);
      if (lastPlayer) {
        onPlayerFinish(gameState, lastPlayer);
      }

      return GamePhaseType.RESULT;
    }

    return null;
  }

  /**
   * 誰かがプレイ可能かチェック
   * 全プレイヤーの手札をチェックし、誰も出せない状況を検出する
   */
  canAnyonePlay(gameState: GameState): boolean {
    const activePlayers = gameState.players.filter(p => !p.isFinished);

    for (const player of activePlayers) {
      // プレイヤーの全ての手札の組み合わせをチェック
      const cards = handGetCards(player.hand);

      // 各カードの組み合わせをチェック
      for (let i = 0; i < cards.length; i++) {
        // 1枚
        const validation = this.ruleEngine.validate(player, [cards[i]], gameState.field, gameState);
        if (validation.valid) {
          return true;
        }

        // 2枚
        for (let j = i + 1; j < cards.length; j++) {
          const validation = this.ruleEngine.validate(player, [cards[i], cards[j]], gameState.field, gameState);
          if (validation.valid) {
            return true;
          }

          // 3枚
          for (let k = j + 1; k < cards.length; k++) {
            const validation = this.ruleEngine.validate(player, [cards[i], cards[j], cards[k]], gameState.field, gameState);
            if (validation.valid) {
              return true;
            }

            // 4枚
            for (let l = k + 1; l < cards.length; l++) {
              const validation = this.ruleEngine.validate(player, [cards[i], cards[j], cards[k], cards[l]], gameState.field, gameState);
              if (validation.valid) {
                return true;
              }

              // 5枚以上は階段のみなので、より効率的にチェック可能だが、簡略化のため省略
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 誰も出せないためゲームを終了
   * 手札が少ない順に順位を設定
   */
  endGameDueToNoPlays(
    gameState: GameState,
    onAssignRank: (gameState: GameState, player: Player) => void
  ): void {
    const activePlayers = gameState.players.filter(p => !p.isFinished);

    // 手札が少ない順にソート
    activePlayers.sort((a, b) => handSize(a.hand) - handSize(b.hand));

    // 順位を設定
    let currentPosition = gameState.players.filter(p => p.isFinished).length + 1;
    let playersAtCurrentPosition = 0;

    for (let i = 0; i < activePlayers.length; i++) {
      const player = activePlayers[i];
      const playerHandSize = handSize(player.hand);

      // 前のプレイヤーと手札枚数が異なる場合、新しい順位に進む
      if (i > 0 && handSize(activePlayers[i - 1].hand) !== playerHandSize) {
        currentPosition += playersAtCurrentPosition;
        playersAtCurrentPosition = 0;
      }

      player.isFinished = true;
      player.finishPosition = currentPosition;
      playersAtCurrentPosition++;
      onAssignRank(gameState, player);

      console.log(`${player.name} finished in position ${player.finishPosition} (手札: ${playerHandSize}枚)`);
    }
  }
}
