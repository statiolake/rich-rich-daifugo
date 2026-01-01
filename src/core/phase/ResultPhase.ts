import { GamePhase } from './GamePhase';
import { GameState, GamePhaseType } from '../domain/game/GameState';
import { PlayerRank, getRankName } from '../domain/player/PlayerRank';
import { Card } from '../domain/card/Card';

export class ResultPhase implements GamePhase {
  readonly type = GamePhaseType.RESULT;

  async enter(gameState: GameState): Promise<void> {
    console.log('=== Game Results ===');

    // 都落ち判定
    const cityFallOccurred = this.applyCityFall(gameState);
    gameState.cityFallOccurred = cityFallOccurred;

    // 村八分判定（都落ち後、9以上のカード没収）
    this.applyMurahachibu(gameState);

    // 京落ち判定（大富豪が連続1着で富豪が大貧民に転落）
    this.applyKyoOchi(gameState);

    // 府落ち判定（都落ち発生＋富豪が2着でない→富豪も貧民に降格）
    this.applyFuOchi(gameState);

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

    // 次ラウンドのために今回の大富豪・大貧民・富豪を記録
    const currentDaifugo = gameState.players.find(p => p.rank === PlayerRank.DAIFUGO);
    if (currentDaifugo) {
      // 連続勝利数を更新
      if (gameState.previousDaifugoId === currentDaifugo.id) {
        gameState.consecutiveDaifugoWins++;
      } else {
        gameState.consecutiveDaifugoWins = 1;
      }
      gameState.previousDaifugoId = currentDaifugo.id;
    } else {
      gameState.consecutiveDaifugoWins = 0;
    }

    const currentDaihinmin = gameState.players.find(p => p.rank === PlayerRank.DAIHINMIN);
    if (currentDaihinmin) {
      gameState.previousDaihinminId = currentDaihinmin.id;
    }

    const currentFugo = gameState.players.find(p => p.rank === PlayerRank.FUGO);
    if (currentFugo) {
      gameState.previousFugoId = currentFugo.id;
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
   * @returns 都落ちが発生したかどうか
   */
  private applyCityFall(gameState: GameState): boolean {
    if (!gameState.ruleSettings.cityFall) return false;
    if (!gameState.previousDaifugoId) return false;

    const previousDaifugo = gameState.players.find(
      p => p.id === gameState.previousDaifugoId
    );
    if (!previousDaifugo) return false;

    // 前の大富豪が今回1位でなければ都落ち
    if (previousDaifugo.finishPosition !== 1) {
      console.log(`都落ち！${previousDaifugo.name} は大貧民に落ちました`);

      // 現在の大貧民を見つけて、そのプレイヤーのランクを1つ上げる
      const currentDaihinmin = gameState.players.find(
        p => p.rank === PlayerRank.DAIHINMIN && p.id !== previousDaifugo.id
      );
      if (currentDaihinmin) {
        // 大貧民だったプレイヤーを貧民に昇格
        currentDaihinmin.rank = PlayerRank.HINMIN;
      }

      // 前の大富豪を大貧民に降格
      previousDaifugo.rank = PlayerRank.DAIHINMIN;
      return true;
    }
    return false;
  }

  /**
   * 京落ち判定
   * 大富豪が連続1着の場合、富豪が大貧民に転落
   */
  private applyKyoOchi(gameState: GameState): void {
    if (!gameState.ruleSettings.kyoOchi) return;
    if (!gameState.previousFugoId) return;

    // 大富豪が連続勝利しているかチェック（2連勝以上）
    if (gameState.consecutiveDaifugoWins < 2) return;

    const previousFugo = gameState.players.find(
      p => p.id === gameState.previousFugoId
    );
    if (!previousFugo) return;

    console.log(`京落ち！大富豪が${gameState.consecutiveDaifugoWins}連勝中！${previousFugo.name}（富豪）は大貧民に落ちます`);

    // 現在の大貧民を見つけて、そのプレイヤーのランクを1つ上げる
    const currentDaihinmin = gameState.players.find(
      p => p.rank === PlayerRank.DAIHINMIN && p.id !== previousFugo.id
    );
    if (currentDaihinmin) {
      // 大貧民だったプレイヤーを貧民に昇格
      currentDaihinmin.rank = PlayerRank.HINMIN;
    }

    // 前の富豪を大貧民に降格
    previousFugo.rank = PlayerRank.DAIHINMIN;
  }

  /**
   * 府落ち判定（名古屋落ち）
   * 都落ち発生＋富豪が2着でない場合、富豪も貧民に降格
   */
  private applyFuOchi(gameState: GameState): void {
    if (!gameState.ruleSettings.fuOchi) return;
    if (!gameState.cityFallOccurred) return; // 都落ちが発生していない場合はスキップ
    if (!gameState.previousFugoId) return;

    const previousFugo = gameState.players.find(
      p => p.id === gameState.previousFugoId
    );
    if (!previousFugo) return;

    // 富豪が2着でなければ府落ち
    if (previousFugo.finishPosition !== 2) {
      console.log(`府落ち！都落ちが発生し、${previousFugo.name}（富豪）は2着でないため貧民に降格します`);

      // 富豪を貧民に降格
      previousFugo.rank = PlayerRank.HINMIN;
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

    if (winner.id !== gameState.previousDaihinminId) return;

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

  /**
   * 村八分判定
   * 都落ち後、9以上のカード（9, 10, J, Q, K, A, 2, Joker）を没収し、残りでプレイ
   * 次ラウンド開始前に効果を記録し、SetupPhaseで適用
   */
  private applyMurahachibu(gameState: GameState): void {
    if (!gameState.ruleSettings.murahachibu) return;
    if (!gameState.cityFallOccurred) return;
    if (!gameState.previousDaifugoId) return;

    // 都落ちしたプレイヤーを見つける
    const fallenDaifugo = gameState.players.find(
      p => p.id === gameState.previousDaifugoId
    );
    if (!fallenDaifugo) return;

    console.log(`村八分！${fallenDaifugo.name} は都落ちのため次ラウンドで9以上のカードが没収されます`);

    // 村八分対象としてマーク（次ラウンドのSetupPhaseで適用）
    // GameStateに村八分対象者を記録
    gameState.murahachibuTargetId = fallenDaifugo.id;
  }
}
