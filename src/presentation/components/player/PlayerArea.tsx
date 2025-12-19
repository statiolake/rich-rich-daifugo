import { Player } from '../../../core/domain/player/Player';
import { getRankName } from '../../../core/domain/player/PlayerRank';

interface PlayerAreaProps {
  player: Player;
  isCurrent: boolean;
  position: { x: number; y: number };
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({ player, isCurrent, position }) => {
  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={`
          p-4 rounded-lg backdrop-blur-sm
          ${isCurrent ? 'bg-yellow-400/30 ring-4 ring-yellow-400' : 'bg-white/20'}
          transition-all duration-300
        `}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="text-white font-bold text-lg">
            {player.name}
          </div>

          <div className="flex items-center gap-2">
            {player.rank && (
              <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                {getRankName(player.rank)}
              </span>
            )}

            {player.isFinished && (
              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                {player.finishPosition}位
              </span>
            )}
          </div>

          <div className="text-white text-sm">
            手札: {player.hand.size()}枚
          </div>

          {isCurrent && !player.isFinished && (
            <div className="text-yellow-300 text-xs animate-pulse">
              ▶ ターン中
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
