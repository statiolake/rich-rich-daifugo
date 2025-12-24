/**
 * 人間プレイヤーの手札位置（画面下部中央）
 */
export function calculateHumanHandPosition(
  cardIndex: number,
  handSize: number
): { x: number; y: number } {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const cardWidth = 64;
  const cardGap = 8;
  const totalWidth = handSize * cardWidth + (handSize - 1) * cardGap;

  const startX = (screenWidth - totalWidth) / 2;
  const x = startX + cardIndex * (cardWidth + cardGap);
  const y = screenHeight - 150;

  return { x, y };
}

/**
 * CPUプレイヤーの手札位置（円形配置）
 */
export function calculateCPUHandPosition(
  playerIndex: number,
  cardIndex: number,
  totalPlayers: number
): { x: number; y: number } {
  // プレイヤー位置（2-5人対応）
  const playerPositions = calculatePlayerPositions(totalPlayers);
  const playerPos = playerPositions[playerIndex];

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const baseX = screenWidth * (playerPos.x / 100);
  const baseY = screenHeight * (playerPos.y / 100);

  // CPUの手札は重ねて表示
  const cardOffset = 3;
  return {
    x: baseX + cardIndex * cardOffset,
    y: baseY,
  };
}

/**
 * 場のカード位置（画面中央、重ねて配置）
 */
export function calculateFieldPosition(
  playIndex: number,
  cardIndex: number,
  totalCardsInPlay: number = 1
): { x: number; y: number; rotation: number } {
  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2 - 48;

  const cardSpacing = 70; // カード間のスペース
  const totalWidth = (totalCardsInPlay - 1) * cardSpacing; // 全体の幅

  // 全体の中心が画面中央に来るように、最初のカードの位置を計算
  const startX = screenCenterX - totalWidth / 2 - 32; // 32はカード幅の半分
  const cardOffsetX = cardIndex * cardSpacing;

  const rotation = (playIndex % 3 - 1) * 2; // -2, 0, 2度

  return {
    x: startX + cardOffsetX,
    y: screenCenterY,
    rotation,
  };
}

/**
 * プレイ人数別のプレイヤー配置
 */
function calculatePlayerPositions(
  playerCount: number
): Array<{ x: number; y: number }> {
  const positions = {
    2: [
      { x: 50, y: 85 }, // 下（人間）
      { x: 50, y: 15 }, // 上
    ],
    3: [
      { x: 50, y: 85 },
      { x: 15, y: 30 },
      { x: 85, y: 30 },
    ],
    4: [
      { x: 50, y: 85 },
      { x: 10, y: 50 },
      { x: 50, y: 15 },
      { x: 90, y: 50 },
    ],
    5: [
      { x: 50, y: 85 },
      { x: 15, y: 60 },
      { x: 15, y: 25 },
      { x: 85, y: 25 },
      { x: 85, y: 60 },
    ],
  };

  return (
    positions[playerCount as keyof typeof positions] || positions[4]
  );
}
