import { GameState } from '../../domain/game/GameState';
import { Player } from '../../domain/player/Player';
import { PlayerRank } from '../../domain/player/PlayerRank';

/**
 * ランク割り当てサービス
 *
 * プレイヤーの順位に基づいてランク（大富豪、富豪、平民、貧民、大貧民）を割り当てる。
 * プレイヤー人数に応じて異なるランク割り当てロジックを適用する。
 */
export class RankAssignmentService {
  /**
   * プレイヤーの順位に基づいてランクを割り当てる
   *
   * @param gameState ゲーム状態
   * @param player ランクを割り当てるプレイヤー
   */
  assignRank(gameState: GameState, player: Player): void {
    const totalPlayers = gameState.players.length;
    const position = player.finishPosition!;

    if (totalPlayers === 4) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.FUGO;
      else if (position === 3) player.rank = PlayerRank.HINMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else if (totalPlayers === 5) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.FUGO;
      else if (position === 3) player.rank = PlayerRank.HEIMIN;
      else if (position === 4) player.rank = PlayerRank.HINMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else if (totalPlayers === 3) {
      if (position === 1) player.rank = PlayerRank.DAIFUGO;
      else if (position === 2) player.rank = PlayerRank.HEIMIN;
      else player.rank = PlayerRank.DAIHINMIN;
    } else {
      // その他の人数の場合は平民
      player.rank = PlayerRank.HEIMIN;
    }
  }
}
