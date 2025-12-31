import { Player, PlayerType } from '../../../core/domain/player/Player';
import { getRankName } from '../../../core/domain/player/PlayerRank';

interface PlayerAreaProps {
  player: Player;
  isCurrent: boolean;
  position: { x: number; y: number };
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({ player, isCurrent, position }) => {
  const isHuman = player.type === PlayerType.HUMAN;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    >
      <div
        className={`
          px-4 py-2 rounded-lg backdrop-blur-sm
          ${isCurrent ? 'bg-yellow-400/20 ring-2 ring-yellow-400/70' : 'bg-black/30'}
          transition-all duration-300
        `}
      >
        <div className="flex flex-col items-center gap-1">
          {/* プレイヤー名 - Orbitronフォントで目立たせる */}
          <div
            className={`
              font-orbitron font-bold text-lg tracking-wide
              ${isCurrent ? 'text-yellow-300' : 'text-white'}
              ${isCurrent ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'}
            `}
            style={{
              textShadow: isCurrent
                ? '0 0 10px rgba(250,204,21,0.6), 0 0 20px rgba(250,204,21,0.4)'
                : undefined,
            }}
          >
            {player.name}
          </div>

          {/* ランクと順位をコンパクトに表示 */}
          <div className="flex items-center gap-2">
            {player.rank && (
              <span className="px-2 py-0.5 bg-purple-600/80 text-white text-xs font-bold rounded">
                {getRankName(player.rank)}
              </span>
            )}

            {player.isFinished && (
              <span className="px-2 py-0.5 bg-green-600/80 text-white text-xs font-bold rounded">
                {player.finishPosition}位
              </span>
            )}
          </div>

          {/* ターン中インジケーター */}
          {isCurrent && !player.isFinished && (
            <div className="text-yellow-300 text-xs font-bold animate-pulse mt-1">
              ▶ TURN
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
