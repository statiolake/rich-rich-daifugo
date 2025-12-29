import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerRank, getRankName } from '../domain/player/PlayerRank';

export class ResultPhase implements GamePhase {
  readonly type = GamePhaseType.RESULT;

  async enter(gameState: GameState): Promise<void> {
    console.log('=== Game Results ===');

    // 都落ち判定
    this.applyCityFall(gameState);

    // 下剋上判定
    this.applyGekokujou(gameState);

    // プレイヤーを順位順にソート
    const sortedPlayers = [...gameState.players].sort((a, b) => {
      return (a.finishPosition || 999) - (b.finishPosition || 999);
    });

    sortedPlayers.forEach(player => {
      const rankName = player.rank ? getRankName(player.rank) : '未確定';
      console.log(`${player.finishPosition}. ${player.name} - ${rankName}`);
    });

    // 次ラウンドのために今回の大富豪・大貧民を記録
    const currentDaifugo = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (currentDaifugo) {
      gameState.previousDaifugoId = currentDaifugo.id.value;
    }

    const currentDaihinmin = gameState.players.find(p => p.rank === PlayerRank.DAIHINMIN);
    if (currentDaihinmin) {
      gameState.previousDaihinminId = currentDaihinmin.id.value;
    }

    console.log('====================');
  }

  async update(_gameState: GameState): Promise<GamePhaseType | null> {
    // 結果フェーズでは自動的に次のラウンドには進まない
    // UIから次のラウンドを開始するか、ゲームを終了するか選択させる
    // Phase 1ではここで停止
    return null;
  }

  async exit(_gameState: GameState): Promise<void> {
    // クリーンアップ
  }

  /**
   * 都落ち判定
   * 前ラウンドの大富豪が今ラウンドで1位にならなかった場合、大貧民になる
   */
  private applyCityFall(gameState: GameState): void {
    if (!gameState.ruleSettings.cityFall) return;
    if (!gameState.previousDaifugoId) return;

    const previousDaifugo = gameState.players.find(
      p => p.id.value === gameState.previousDaifugoId
    );
    if (!previousDaifugo) return;

    // 前の大富豪が今回1位でなければ都落ち
    if (previousDaifugo.finishPosition !== 1) {
      console.log(`都落ち！${previousDaifugo.name} は大貧民に落ちました`);

      // 現在の大貧民を見つけて、そのプレイヤーのランクを1つ上げる
      const currentDaihinmin = gameState.players.find(
        p => p.rank === PlayerRank.DAIHINMIN && p.id.value !== previousDaifugo.id.value
      );
      if (currentDaihinmin) {
        // 大貧民だったプレイヤーを貧民に昇格
        currentDaihinmin.rank = PlayerRank.HINMIN;
      }

      // 前の大富豪を大貧民に降格
      previousDaifugo.rank = PlayerRank.DAIHINMIN;
    }
  }

  /**
   * 下剋上判定
   * 前ラウンドの大貧民が今ラウンドで1位になった場合、全員のランクが逆転
   */
  private applyGekokujou(gameState: GameState): void {
    if (!gameState.ruleSettings.gekokujou) return;
    if (!gameState.previousDaihinminId) return;

    // 今回の1位が前ラウンドの大貧民かチェック
    const winner = gameState.players.find(p => p.finishPosition === 1);
    if (!winner) return;

    if (winner.id.value !== gameState.previousDaihinminId) return;

    console.log(`下剋上！${winner.name} が大貧民から1位に！全員のランクが逆転します`);

    // 全員のランクを逆転
    const rankOrder = [
      PlayerRank.DAIFUGO,
      PlayerRank.FUGO,
      PlayerRank.HEIMIN,
      PlayerRank.HINMIN,
      PlayerRank.DAIHINMIN,
    ];

    const reverseRankOrder = [...rankOrder].reverse();

    for (const player of gameState.players) {
      if (!player.rank) continue;

      const currentIndex = rankOrder.indexOf(player.rank);
      if (currentIndex !== -1) {
        player.rank = reverseRankOrder[currentIndex];
      }
    }
  }
}
