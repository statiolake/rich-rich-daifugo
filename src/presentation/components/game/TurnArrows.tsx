import { motion } from 'framer-motion';

interface TurnArrowsProps {
  currentPlayerIndex: number;
  playerCount: number;
  isReversed?: boolean;
}

export const TurnArrows: React.FC<TurnArrowsProps> = ({
  currentPlayerIndex,
  playerCount,
  isReversed = false,
}) => {
  // Player positions (matching GameBoard layout)
  // 0: Bottom (50%, 85%) - Human
  // 1: Left (10%, 50%)
  // 2: Top (50%, 15%)
  // 3: Right (90%, 50%)

  // Arrow paths between players (curved bezier paths)
  // Normal order: 0→1→2→3→0 (counter-clockwise visually)
  const arrowPaths = [
    // 0 (Bottom) → 1 (Left)
    {
      from: { x: 35, y: 75 },
      to: { x: 18, y: 58 },
      control: { x: 22, y: 72 },
    },
    // 1 (Left) → 2 (Top)
    {
      from: { x: 18, y: 42 },
      to: { x: 35, y: 25 },
      control: { x: 22, y: 28 },
    },
    // 2 (Top) → 3 (Right)
    {
      from: { x: 65, y: 25 },
      to: { x: 82, y: 42 },
      control: { x: 78, y: 28 },
    },
    // 3 (Right) → 0 (Bottom)
    {
      from: { x: 82, y: 58 },
      to: { x: 65, y: 75 },
      control: { x: 78, y: 72 },
    },
  ];

  // Calculate next player index
  const getNextPlayerIndex = (current: number): number => {
    if (isReversed) {
      return (current - 1 + playerCount) % playerCount;
    }
    return (current + 1) % playerCount;
  };

  // Get the arrow index that shows current → next
  const activeArrowIndex = isReversed
    ? (currentPlayerIndex - 1 + playerCount) % playerCount
    : currentPlayerIndex;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradient for active arrow */}
          <linearGradient id="activeArrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(250, 204, 21, 0.3)" />
            <stop offset="50%" stopColor="rgba(250, 204, 21, 0.8)" />
            <stop offset="100%" stopColor="rgba(250, 204, 21, 0.3)" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="arrowGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Arrow marker */}
          <marker
            id="arrowHead"
            markerWidth="3"
            markerHeight="3"
            refX="2"
            refY="1.5"
            orient="auto"
          >
            <polygon
              points="0,0 3,1.5 0,3"
              fill="rgba(250, 204, 21, 0.6)"
            />
          </marker>

          <marker
            id="arrowHeadActive"
            markerWidth="4"
            markerHeight="4"
            refX="2.5"
            refY="2"
            orient="auto"
          >
            <polygon
              points="0,0 4,2 0,4"
              fill="rgba(250, 204, 21, 1)"
            />
          </marker>

          <marker
            id="arrowHeadDim"
            markerWidth="2.5"
            markerHeight="2.5"
            refX="1.5"
            refY="1.25"
            orient="auto"
          >
            <polygon
              points="0,0 2.5,1.25 0,2.5"
              fill="rgba(255, 255, 255, 0.15)"
            />
          </marker>
        </defs>

        {arrowPaths.map((path, index) => {
          const isActive = index === activeArrowIndex;
          const pathData = isReversed
            ? `M ${path.to.x} ${path.to.y} Q ${path.control.x} ${path.control.y} ${path.from.x} ${path.from.y}`
            : `M ${path.from.x} ${path.from.y} Q ${path.control.x} ${path.control.y} ${path.to.x} ${path.to.y}`;

          return (
            <g key={index}>
              {/* Background/dim arrow */}
              <path
                d={pathData}
                fill="none"
                stroke={isActive ? "transparent" : "rgba(255, 255, 255, 0.1)"}
                strokeWidth={isActive ? 0 : 0.4}
                strokeLinecap="round"
                markerEnd={isActive ? undefined : "url(#arrowHeadDim)"}
              />

              {/* Active arrow with animation */}
              {isActive && (
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Glow effect */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="rgba(250, 204, 21, 0.3)"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    filter="url(#arrowGlow)"
                  />

                  {/* Main arrow */}
                  <motion.path
                    d={pathData}
                    fill="none"
                    stroke="url(#activeArrowGradient)"
                    strokeWidth={0.6}
                    strokeLinecap="round"
                    markerEnd="url(#arrowHeadActive)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />

                  {/* Animated dot traveling along path */}
                  <motion.circle
                    r={0.8}
                    fill="rgba(250, 204, 21, 1)"
                    filter="url(#arrowGlow)"
                  >
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={pathData}
                    />
                  </motion.circle>
                </motion.g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
