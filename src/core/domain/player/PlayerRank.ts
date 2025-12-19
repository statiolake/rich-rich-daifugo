export enum PlayerRank {
  DAIHINMIN = 'DAIHINMIN',    // 大貧民
  HINMIN = 'HINMIN',          // 貧民
  HEIMIN = 'HEIMIN',          // 平民
  FUGO = 'FUGO',              // 富豪
  DAIFUGO = 'DAIFUGO',        // 大富豪
}

export function getRankName(rank: PlayerRank): string {
  switch (rank) {
    case PlayerRank.DAIFUGO:
      return '大富豪';
    case PlayerRank.FUGO:
      return '富豪';
    case PlayerRank.HEIMIN:
      return '平民';
    case PlayerRank.HINMIN:
      return '貧民';
    case PlayerRank.DAIHINMIN:
      return '大貧民';
  }
}
