import { useGameStore } from '../../store/gameStore';
import { PlayerArea } from '../player/PlayerArea';
import { HumanControl } from '../player/HumanControl';
import { UnifiedCardLayer } from './UnifiedCardLayer';
import { GamePhaseType } from '../../../core/domain/game/GameState';
import { getRankName } from '../../../core/domain/player/PlayerRank';

export const GameBoard: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const startGame = useGameStore(state => state.startGame);
  const reset = useGameStore(state => state.reset);

  if (!gameState) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-8">大富豪</h1>
          <p className="text-xl text-white/80 mb-8">Rich Rich Daifugo</p>
          <button
            onClick={() => startGame()}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white text-xl font-bold rounded-lg shadow-lg transition-colors"
          >
            ゲーム開始
          </button>
        </div>
      </div>
    );
  }

  // ゲーム終了時の結果画面
  if (gameState.phase === GamePhaseType.RESULT) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-8">ゲーム結果</h1>
          <div className="text-2xl text-white mb-8 max-h-64 overflow-y-auto">
            {gameState.players
              .filter(p => p.rank !== null)
              .sort((a, b) => {
                if (a.finishPosition === null || b.finishPosition === null) return 0;
                return a.finishPosition - b.finishPosition;
              })
              .map((player, idx) => (
                <div key={player.id.value} className="mb-4">
                  <span className="font-bold text-yellow-300">{idx + 1}位</span>: {player.name} ({player.rank ? getRankName(player.rank) : ''})
                </div>
              ))}
          </div>
          <button
            onClick={() => {
              reset();
              startGame();
            }}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white text-xl font-bold rounded-lg shadow-lg transition-colors"
          >
            もう一度プレイ
          </button>
        </div>
      </div>
    );
  }

  // プレイヤーの配置位置を計算（4人用の円形配置）
  const calculatePosition = (index: number, total: number): { x: number; y: number } => {
    // 下（人間プレイヤー）、左、上、右の順
    const positions = [
      { x: 50, y: 85 },  // 下（人間）
      { x: 10, y: 50 },  // 左
      { x: 50, y: 15 },  // 上
      { x: 90, y: 50 },  // 右
    ];

    return positions[index] || { x: 50, y: 50 };
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-green-800 to-green-600 overflow-hidden">
      {/* ゲーム情報 */}
      <div className="absolute top-4 left-4 text-white">
        <div className="backdrop-blur-sm bg-black/20 p-4 rounded-lg">
          <div className="text-sm opacity-75">ラウンド {gameState.round}</div>
          <div className="text-sm opacity-75">
            フェーズ: {gameState.phase}
          </div>
          {gameState.isRevolution && (
            <div className="text-yellow-300 font-bold animate-pulse">
              革命中！
            </div>
          )}
        </div>
      </div>

      {/* プレイヤーエリア */}
      {gameState.players.map((player, index) => (
        <PlayerArea
          key={player.id.value}
          player={player}
          position={calculatePosition(index, gameState.players.length)}
          isCurrent={index === gameState.currentPlayerIndex}
        />
      ))}

      {/* 人間プレイヤーのコントロール */}
      <HumanControl />

      {/* 統一されたカード表示レイヤー（54枚全てを管理） */}
      <UnifiedCardLayer />
    </div>
  );
};
