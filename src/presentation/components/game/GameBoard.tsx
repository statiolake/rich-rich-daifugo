import { useGameStore } from '../../store/gameStore';
import { Field } from './Field';
import { PlayerArea } from '../player/PlayerArea';
import { HumanControl } from '../player/HumanControl';
import { MovingCardLayer } from './MovingCardLayer';

export const GameBoard: React.FC = () => {
  const gameState = useGameStore(state => state.gameState);
  const startGame = useGameStore(state => state.startGame);

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

      {/* 場のカード表示 */}
      <Field field={gameState.field} />

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

      {/* カード移動アニメーションレイヤー */}
      <MovingCardLayer />
    </div>
  );
};
