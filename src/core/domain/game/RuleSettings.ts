/**
 * ローカルルール設定
 * 各ルールのON/OFF状態を管理
 */
export interface RuleSettings {
  // 場をクリアするルール
  eightCut: boolean;           // 8切り
  fiveCut: boolean;            // 5切り（革命中に5を出すと場が流れる）
  sixCut: boolean;             // 6切り（革命中に6を出すと場が流れる）
  sevenCut: boolean;           // 7切り（革命中に7を出すと場が流れる）
  ambulance: boolean;          // 救急車（9x2）
  rokurokubi: boolean;         // ろくろ首（6x2）

  // 革命バリエーション
  stairRevolution: boolean;    // 階段革命（4枚以上の階段で革命）
  nanasanRevolution: boolean;  // ナナサン革命（7x3で革命）
  emperor: boolean;            // エンペラー（4種マーク連番）
  coup: boolean;               // クーデター（9x3）
  greatRevolution: boolean;    // 大革命（2x4で即勝利）
  omen: boolean;               // オーメン（6x3で革命＋以後革命なし）
  jokerRevolution: boolean;    // ジョーカー革命（ジョーカー2枚同時で革命）

  // 特殊勝利条件
  forbiddenFinish: boolean;    // 禁止上がり（J/2/8/Jokerで上がれない）

  // カード強度ルール
  sandstorm: boolean;          // 砂嵐（3x3が何にでも勝つ）
  tripleThreeReturn: boolean;  // 33返し（3x3がジョーカー1枚を切れる）
  assassination: boolean;      // 暗殺（2に対して3を出すと場を流せる、革命中は逆）
  spadeThreeReturn: boolean;   // スぺ3返し（スペードの3がJokerに勝つ）
  spadeTwoReturn: boolean;     // スペ2返し（革命中ジョーカーに対してスペード2で流せる）
  stairs: boolean;             // 階段（同じマークの連番）
  redSevenPower: boolean;      // レッドセブン（通常時に♥7/♦7が2より強くジョーカーより弱くなる）
  blackSevenPower: boolean;    // ブラックセブン（革命中に♠7/♣7が3より強くジョーカーより弱くなる）

  // フィールド効果
  fourStop: boolean;           // 4止め（4x2で8切りを止める）
  suitLock: boolean;           // マークしばり
  numberLock: boolean;         // 数字しばり
  strictLock: boolean;         // 激縛り（完縛り）- マーク+数字両方で縛り
  colorLock: boolean;          // 色縛り（同じ色が連続で赤/黒縛り）
  queenRelease: boolean;       // Q解き（縛り中にQを出すと解除）
  sixReturn: boolean;          // 6戻し（11バック中に6を出すと解除）

  // 偶数/奇数制限
  sevenCounter: boolean;       // 7カウンター（8切り発生時にスペード7を出すと8切りをキャンセル）
  evenRestriction: boolean;    // 偶数制限（4を出すと場が流れるまで偶数のみ出せる）
  oddRestriction: boolean;     // 奇数制限（5を出すと場が流れるまで奇数のみ出せる）

  // ターン操作
  fiveSkip: boolean;           // 5スキップ
  freemason: boolean;          // フリーメイソン（6を1枚出すと次のプレイヤーをスキップ）
  tenSkip: boolean;            // 10飛び（10を出すと次のプレイヤーをスキップ）
  tenFree: boolean;            // 10フリ（10を出した後、次のプレイヤーはどんなカードでも出せる）
  sevenPass: boolean;          // 7渡し
  sevenAttach: boolean;        // 7付け（7を出すと枚数分のカードを追加で捨てる）
  nineReturn: boolean;         // 9戻し（9を出すと枚数分のカードを直前のプレイヤーに渡す）
  tenDiscard: boolean;         // 10捨て
  nineReverse: boolean;        // 9リバース
  nineQuick: boolean;          // 9クイック（9を出すと続けてもう1回出せる）
  queenReverse: boolean;       // Qリバース（Qを出すと席順が逆転）
  kingReverse: boolean;        // Kリバース（Kを出すと席順が逆転）
  kingPastor: boolean;         // キング牧師（Kを出すと全員が右隣に任意カード1枚を渡す）
  reKing: boolean;             // Re:KING（Kを出すと全員が捨て札からK枚数分ランダムに引く）

  // 特殊効果
  queenBomber: boolean;        // クイーンボンバー
  jeanneDArc: boolean;         // ジャンヌダルク（Qx3で次のプレイヤーが手札から最強カード2枚を捨てる）
  bloodyMary: boolean;         // ブラッディメアリ（Qx3で全員が手札から最強カード2枚を捨てる）
  downNumber: boolean;         // ダウンナンバー
  twoBack: boolean;            // 2バック（2を出すと場が流れるまで強さ逆転）
  zombie: boolean;             // ゾンビ（3x3で捨て札から任意カードを次のプレイヤーに渡す）
  enhancedJBack: boolean;      // 強化Jバック（Jx3で11バックが2回場が流れるまで持続）
  damian: boolean;             // ダミアン（6x3で場が流れるまでパスした人は敗北）
  death: boolean;              // DEATH（4x3で全員が最強カードを捨てる）
  thief: boolean;              // シーフ（4x3で次のプレイヤーから最強カードを奪う）
  nero: boolean;               // ネロ（Kx3で各対戦相手から最強カードを1枚ずつ奪う）
  kingsPrivilege: boolean;     // 王の特権（Kx3で左隣のプレイヤーと手札を全交換する）

  // 捨て札回収ルール
  salvage: boolean;            // サルベージ（3で場が流れた時に捨て札から1枚回収）
  kingsMarch: boolean;         // キングの行進（Kを出すと枚数分捨て札から回収）
  satan: boolean;              // サタン（6x3で捨て札から任意カード1枚を回収）
  chestnutPicking: boolean;    // 栗拾い（9を出すと枚数分だけ捨て札から回収）
  galaxyExpress999: boolean;   // 銀河鉄道999（9x3で手札2枚を捨て、捨て札から2枚引く）
  blackSeven: boolean;         // 黒7（スペード7またはクラブ7を出すと、枚数分だけ捨て山からランダムにカードを引く）
  tyrant: boolean;             // 暴君（2を出すと自分以外の全員が捨て札からランダムに1枚引く）
  resurrection: boolean;       // 死者蘇生（4を出すと、直前に出されたカードを枚数分手札に加える）

  // ジョーカー関連
  jokerReturn: boolean;        // ジョーカー返し（ジョーカー1枚に対してもう1枚のジョーカーを重ねて出せる）

  // 親権ルール
  nextAce: boolean;            // 次期エース（Aで場が流れた時に親になる）

  // ゲーム終了後のルール
  cityFall: boolean;           // 都落ち
  gekokujou: boolean;          // 下剋上
  luckySeven: boolean;         // ラッキーセブン
  catastrophe: boolean;        // 天変地異

  // 情報公開ルール
  fivePick: boolean;           // 5ピック（5を出すと枚数分だけ好きなプレイヤーの手札を見れる）
  weakShow: boolean;           // 弱見せ（9を出すと次のプレイヤーの最弱カードを公開）
  strongShow: boolean;         // 強見せ（6を出すと次のプレイヤーの最強カードを公開）

  // 出せるカード制限
  doubleDigitSeal: boolean;    // 2桁封じ（6を出すと場が流れるまでJ〜K（11〜13）が出せなくなる）
  hotMilk: boolean;            // ホットミルク（3の上に9を出すとダイヤ/ハートのみ出せる）

  // ジョーカー請求・Qラブ
  jokerSeize: boolean;         // ジョーカー請求（4を出した時、次のプレイヤーがジョーカーを持っていれば強制的に奪う）
  queenLove: boolean;          // Qラブ（Q（階段以外）を出すと、枚数分だけ捨て札から回収＋連続ターン）

  // 上がり・税収ルール
  finishFlow: boolean;         // 上がり流し（プレイヤーが上がった時に場が流れる）
  aceTax: boolean;             // A税収（子がAを出した時、直前のカードを手札に加え、次のプレイヤーをスキップ）

  // 追加の色縛りルール
  fiveColorLock: boolean;      // 5色縛り（5を1枚出すとその色で縛り発動）

  // 場をクリアする追加ルール
  dignity: boolean;            // 威厳（J-Q-Kの階段で場が流れる）

  // キング系ルール
  arthur: boolean;             // アーサー（Kx3でジョーカーが10〜Jの間の強さになる）
  doubleKing: boolean;         // ダブルキング（Kx2がK以下のペアとして出せる）

  // 手札交換・ランク変動ルール
  redFive: boolean;            // 赤い5（♥5/♦5を1枚出すと指名者と手札をシャッフルして同数に再配布）
  gloriousRevolution: boolean; // 名誉革命（4x4で革命せず、大富豪を大貧民に転落）

  // 特殊効果ルール（4枚系）
  industrialRevolution: boolean; // 産業革命（3x4で全員の手札を見て1人1枚ずつ回収）
  deathSentence: boolean;        // 死の宣告（4x4で指名者は以降パスすると敗北）

  // カード交換ルール
  blackMarket: boolean;        // 闇市（Ax3で指名者と任意2枚⇔最強2枚を交換）

  // 特殊出しルール
  crossDressing: boolean;      // 女装（Qを出す時、同枚数のKも一緒に出せる）

  // 9系ルール
  nineGamble: boolean;         // 9賭け（9を出すと指名者がランダムで自分の手札を1枚捨てる）
  nineShuffle: boolean;        // 9シャッフル（9x2で対戦相手の席順を自由に変更）

  // カード請求ルール
  sixClaim: boolean;           // 6もらい（6を出すと指名者にカード宣言、持っていれば貰える）
  nineClaim: boolean;          // 9もらい（9を出すと指名者に欲しいカードを宣言、持っていれば貰う）

  // カウントダウン系ルール
  endCountdown: boolean;       // 終焉のカウントダウン（大貧民が4x1を出すとカウントダウン開始、0でパスした人が敗北）
  teleforce: boolean;          // テレフォース（4x1を出すと7ターン後に全員敗北、残り手札で順位決定）
}

/**
 * デフォルトルール設定
 * 全てのルールをONにする
 */
export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  eightCut: true,
  fiveCut: true,
  sixCut: true,
  sevenCut: true,
  ambulance: true,
  rokurokubi: true,
  stairRevolution: true,
  nanasanRevolution: true,
  emperor: true,
  coup: true,
  greatRevolution: true,
  omen: true,
  jokerRevolution: true,
  forbiddenFinish: true,
  sandstorm: true,
  tripleThreeReturn: true,
  assassination: true,
  spadeThreeReturn: true,
  spadeTwoReturn: true,
  stairs: true,
  redSevenPower: false,
  blackSevenPower: false,
  fourStop: true,
  suitLock: true,
  numberLock: true,
  strictLock: true,
  colorLock: true,
  queenRelease: true,
  sixReturn: true,
  sevenCounter: true,
  evenRestriction: true,
  oddRestriction: true,
  fiveSkip: true,
  freemason: true,
  tenSkip: true,
  tenFree: true,
  sevenPass: true,
  sevenAttach: true,
  nineReturn: true,
  tenDiscard: true,
  nineReverse: true,
  nineQuick: true,
  queenReverse: true,
  kingReverse: true,
  kingPastor: true,
  reKing: true,
  queenBomber: true,
  jeanneDArc: true,
  bloodyMary: true,
  downNumber: true,
  twoBack: true,
  zombie: true,
  enhancedJBack: true,
  damian: true,
  death: true,
  thief: true,
  nero: true,
  kingsPrivilege: true,
  salvage: true,
  kingsMarch: true,
  satan: true,
  chestnutPicking: true,
  galaxyExpress999: true,
  blackSeven: true,
  tyrant: true,
  resurrection: true,
  jokerReturn: true,
  nextAce: true,
  cityFall: true,
  gekokujou: true,
  luckySeven: true,
  catastrophe: true,
  fivePick: true,
  weakShow: true,
  strongShow: true,
  doubleDigitSeal: true,
  hotMilk: true,
  jokerSeize: false,
  queenLove: false,
  finishFlow: false,
  aceTax: false,
  fiveColorLock: false,
  dignity: false,
  arthur: false,
  doubleKing: false,
  redFive: false,
  gloriousRevolution: false,
  industrialRevolution: false,
  deathSentence: false,
  blackMarket: false,
  crossDressing: false,
  nineGamble: false,
  nineShuffle: false,
  sixClaim: false,
  nineClaim: false,
  endCountdown: false,
  teleforce: false,
};
