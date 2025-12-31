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
  skipStairRevolution: boolean; // 飛び連番革命（等差数列の同スート4枚以上で革命）
  religiousRevolution: boolean; // 宗教革命（Kx4でQ最強、A最弱＋偶奇縛り）
  superRevolution: boolean;     // 超革命（5枚以上で革命、以降革命不可）
  revolutionFlow: boolean;      // 革命流し（革命カードに8が含まれると8切り効果）
  fusionRevolution: boolean;    // 融合革命（場札＋手札で4枚以上で革命、両者ターン休み）
  tsuiKaku: boolean;            // 追革（場のペアと同数字ペアを重ねると革命、子は全員パス）

  // 特殊勝利条件
  forbiddenFinish: boolean;    // 禁止上がり（J/2/8/Jokerで上がれない）

  // カード強度ルール
  sandstorm: boolean;          // 砂嵐（3x3が何にでも勝つ）
  tripleThreeReturn: boolean;  // 33返し（3x3がジョーカー1枚を切れる）
  assassination: boolean;      // 暗殺（2に対して3を出すと場を流せる、革命中は逆）
  spadeThreeReturn: boolean;   // スぺ3返し（スペードの3がJokerに勝つ）
  spadeTwoReturn: boolean;     // スペ2返し（革命中ジョーカーに対してスペード2で流せる）
  stairs: boolean;             // 階段（同じマークの連番）
  skipStair: boolean;          // 飛び階段（同スートで公差がある3枚以上、例：4,6,8）
  doubleStair: boolean;        // 二列階段/一盃口（同ランク2枚ずつで階段、例：3x2,4x2,5x2）
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

  // 都落ち派生ルール
  kyoOchi: boolean;            // 京落ち（大富豪が連続1着で富豪が大貧民に転落）
  fuOchi: boolean;             // 府落ち（都落ち発生＋富豪が2着でない→富豪も貧民に降格）
  reparations: boolean;        // 賠償金（都落ち後も継続参加で先に上がった全員と追加1枚交換）
  babaOchi: boolean;           // ババ落ち（ジョーカー含む5枚で革命→もう1枚のジョーカー所持者は敗北）
  nuclearBomb: boolean;        // 核爆弾（6枚以上で革命→ゲーム終了まで革命固定）
  murahachibu: boolean;        // 村八分（都落ち後、9以上のカード没収、残りでプレイ）

  // 交換枚数バリエーション
  absoluteMonarchy: boolean;   // 絶対王政（富豪1枚、貧民2枚、大貧民3枚を大富豪に献上）
  monarchyDefense: boolean;    // 王政防衛（連続大富豪で交換枚数が連続回数＋1枚に増加）
  antiMonopoly: boolean;       // 独占禁止法（大富豪に2とJokerが5枚以上で2を他プレイヤーに配布）
  inheritanceTax: boolean;     // 相続税（連続大富豪で交換枚数が3→4→5枚と増加）
  blindExchange: boolean;      // 伏せ交換（貧民が裏向きで並べ、富豪が任意位置から抜く）

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

  // ゲーム終了ルール
  aceJanaiKa: boolean;         // Aじゃないか（Ax4でゲーム終了、全員平民に）

  // 片縛りルール
  partialLock: boolean;        // 片縛り（複数枚で一部スートが一致すると、そのスートを含む組み合わせのみ出せる）

  // 即勝利条件ルール
  taepodong: boolean;          // テポドン（同数4枚＋ジョーカー2枚で革命＋即上がり）
  monopoly: boolean;           // モノポリー（同スートA〜K全13枚を所持で即勝利）
  dokan: boolean;              // どかん（場のカード合計=手札合計で即勝利）
  tenho: boolean;              // 天和（配布時に手札が全てペアで即上がり）

  // 10系ルール（ジョーカー関連）
  crusade: boolean;            // 十字軍（10x4で革命＋ジョーカー保持者から全ジョーカーを奪う）
  auction: boolean;            // オークション（10x3でジョーカー所持者から1枚ジョーカーを奪う）

  // 8切り関連ルール
  yagiriNoWatashi: boolean;    // 矢切の渡し（8を出すと8切り＋任意プレイヤーにカードを渡せる）
  eightCounter: boolean;       // 8切り返し（8切り発生時に他プレイヤーが8を重ねて自分の番に）
  tenCounter: boolean;         // 10返し（8切り発生時、同スートの10を出すと8切り無効化）
  enhancedEightCut: boolean;   // 強化8切り（8x3で場のカードをゲームから完全除外）

  // 特殊階段ルール
  tunnel: boolean;             // トンネル（A→2→3の階段、最弱の階段として扱う）
  spadeStair: boolean;         // スペ階（♠2→Joker→♠3の階段、最強で場が流れる）

  // 追加ルール（ビルドエラー修正用）
  guillotineClock: boolean;    // ギロチン時計（4を出すとカウントダウン開始）
  supplyAid: boolean;          // 物資救援
  scavenging: boolean;         // 拾い食い
  cartel: boolean;             // カルテル（大貧民が3-4-5の階段で発動）

  // 語呂合わせ革命
  southernCross: boolean;      // サザンクロス（3,3,9,6を同時出しで革命）- 南十字星「3396」
  heiankyoFlow: boolean;       // 平安京流し（同スート7,9,4を出すといつでも出せて場が流れる）- 「794」年
  cyclone: boolean;            // サイクロン（同スート3,A,9,6を出すと全員の手札を混ぜて再配布）- 「3196」
  konagonaRevolution: boolean; // 粉々革命（同色5×2枚、7×2枚を出すと出した人が大富豪）- 「5757」
  yoroshikuRevolution: boolean; // 世露死苦革命（4,6,4,9を出すと革命）- 「4649」
  shininasaiRevolution: boolean; // 死になさい革命（♠4,2,7,3,Aを出すと革命＋指名者を大貧民に）- 「42731」

  // 開始・終了ルール
  diamond3Start: boolean;      // ダイヤ3スタート（ダイヤ3所持者が親、最初にダイヤ3を含める）
  daifugoLeisure: boolean;     // 大富豪の余裕（大富豪は最初の1手で必ずパス）
  adauchiBan: boolean;         // 仇討ち禁止令（都落ちさせた相手を都落ちさせて上がれない）
  securityLaw: boolean;        // 治安維持法（都落ちプレイヤーは革命を起こせない）
  shiminByodo: boolean;        // 四民平等（1ゲーム中に革命が4回以上で全員平民に）

  // 開始ルール（配布系）
  discriminatoryDeal: boolean; // 差別配り（階級に応じて配布枚数を増減：大富豪-2枚、富豪-1枚、貧民+1枚、大貧民+2枚）
  blindCard: boolean;          // ブラインドカード（端数分のカードを抜いて伏せておく）
  trump: boolean;              // 切り札/ドラ（配布時に1枚伏せてその数字が最強に）

  // カード操作系ルール
  guerrilla: boolean;          // ゲリラ兵（場のカードと同数字をより多く持つ時、手札から捨て札に直接送れる）
  catapult: boolean;           // カタパルト（場のカードと同数字を追加で出し、4枚以上で革命発動）
  spadeCounter: boolean;       // スペード返し（特殊効果発動時に同数字スペードで効果キャンセル）
  bananaIce: boolean;          // バナナアイス（同色6枚の階段は直接捨て札に送れる）
}

/**
 * デフォルトルール設定
 * 全てのルールをONにする
 */
export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  // 場をクリアするルール
  eightCut: true,
  fiveCut: true,
  sixCut: true,
  sevenCut: true,
  ambulance: true,
  rokurokubi: true,

  // 革命バリエーション
  stairRevolution: true,
  nanasanRevolution: true,
  emperor: true,
  coup: true,
  greatRevolution: true,
  omen: true,
  jokerRevolution: true,
  skipStairRevolution: true,
  religiousRevolution: true,
  superRevolution: true,
  revolutionFlow: true,
  fusionRevolution: true,
  tsuiKaku: true,

  // 特殊勝利条件
  forbiddenFinish: true,

  // カード強度ルール
  sandstorm: true,
  tripleThreeReturn: true,
  assassination: true,
  spadeThreeReturn: true,
  spadeTwoReturn: true,
  stairs: true,
  skipStair: true,
  doubleStair: true,
  redSevenPower: true,
  blackSevenPower: true,

  // フィールド効果
  fourStop: true,
  suitLock: true,
  numberLock: true,
  strictLock: true,
  colorLock: true,
  queenRelease: true,
  sixReturn: true,

  // 偶数/奇数制限
  sevenCounter: true,
  evenRestriction: true,
  oddRestriction: true,

  // ターン操作
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

  // 特殊効果
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

  // 捨て札回収ルール
  salvage: true,
  kingsMarch: true,
  satan: true,
  chestnutPicking: true,
  galaxyExpress999: true,
  blackSeven: true,
  tyrant: true,
  resurrection: true,

  // ジョーカー関連
  jokerReturn: true,

  // 親権ルール
  nextAce: true,

  // ゲーム終了後のルール
  cityFall: true,
  gekokujou: true,
  luckySeven: true,
  catastrophe: true,

  // 都落ち派生ルール
  kyoOchi: true,
  fuOchi: true,
  reparations: true,
  babaOchi: true,
  nuclearBomb: true,
  murahachibu: true,

  // 交換枚数バリエーション
  absoluteMonarchy: true,
  monarchyDefense: true,
  antiMonopoly: true,
  inheritanceTax: true,
  blindExchange: true,

  // 情報公開ルール
  fivePick: true,
  weakShow: true,
  strongShow: true,

  // 出せるカード制限
  doubleDigitSeal: true,
  hotMilk: true,

  // ジョーカー請求・Qラブ
  jokerSeize: true,
  queenLove: true,

  // 上がり・税収ルール
  finishFlow: true,
  aceTax: true,

  // 追加の色縛りルール
  fiveColorLock: true,

  // 場をクリアする追加ルール
  dignity: true,

  // キング系ルール
  arthur: true,
  doubleKing: true,

  // 手札交換・ランク変動ルール
  redFive: true,
  gloriousRevolution: true,

  // 特殊効果ルール（4枚系）
  industrialRevolution: true,
  deathSentence: true,

  // カード交換ルール
  blackMarket: true,

  // 特殊出しルール
  crossDressing: true,

  // 9系ルール
  nineGamble: true,
  nineShuffle: true,

  // カード請求ルール
  sixClaim: true,
  nineClaim: true,

  // カウントダウン系ルール
  endCountdown: true,
  teleforce: true,

  // ゲーム終了ルール
  aceJanaiKa: true,

  // 片縛りルール
  partialLock: true,

  // 即勝利条件ルール
  taepodong: true,
  monopoly: true,
  dokan: true,
  tenho: true,

  // 10系ルール（ジョーカー関連）
  crusade: true,
  auction: true,

  // 8切り関連ルール
  yagiriNoWatashi: true,
  eightCounter: true,
  tenCounter: true,
  enhancedEightCut: true,

  // 特殊階段ルール
  tunnel: true,
  spadeStair: true,

  // 追加ルール
  guillotineClock: true,
  supplyAid: true,
  scavenging: true,
  cartel: true,

  // 語呂合わせ革命
  southernCross: true,
  heiankyoFlow: true,
  cyclone: true,
  konagonaRevolution: true,
  yoroshikuRevolution: true,
  shininasaiRevolution: true,

  // 開始・終了ルール
  diamond3Start: true,
  daifugoLeisure: true,
  adauchiBan: true,
  securityLaw: true,
  shiminByodo: true,

  // 開始ルール（配布系）
  discriminatoryDeal: true,
  blindCard: true,
  trump: true,

  // カード操作系ルール
  guerrilla: true,
  catapult: true,
  spadeCounter: true,
  bananaIce: true,
};
