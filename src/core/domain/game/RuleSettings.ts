/**
 * ローカルルール設定
 * 各ルールのON/OFF状態を管理
 */
export interface RuleSettings {
  // 場をクリアするルール
  eightCut: boolean;           // 8切り
  ambulance: boolean;          // 救急車（9x2）
  rokurokubi: boolean;         // ろくろ首（6x2）

  // 革命バリエーション
  stairRevolution: boolean;    // 階段革命（4枚以上の階段で革命）
  nanasanRevolution: boolean;  // ナナサン革命（7x3で革命）
  emperor: boolean;            // エンペラー（4種マーク連番）
  coup: boolean;               // クーデター（9x3）
  greatRevolution: boolean;    // 大革命（2x4で即勝利）
  omen: boolean;               // オーメン（6x3で革命＋以後革命なし）

  // 特殊勝利条件
  forbiddenFinish: boolean;    // 禁止上がり（J/2/8/Jokerで上がれない）

  // カード強度ルール
  sandstorm: boolean;          // 砂嵐（3x3が何にでも勝つ）
  spadeThreeReturn: boolean;   // スぺ3返し（スペードの3がJokerに勝つ）
  stairs: boolean;             // 階段（同じマークの連番）

  // フィールド効果
  fourStop: boolean;           // 4止め（4x2で8切りを止める）
  suitLock: boolean;           // マークしばり
  numberLock: boolean;         // 数字しばり
  strictLock: boolean;         // 激縛り（完縛り）- マーク+数字両方で縛り
  colorLock: boolean;          // 色縛り（同じ色が連続で赤/黒縛り）
  queenRelease: boolean;       // Q解き（縛り中にQを出すと解除）
  sixReturn: boolean;          // 6戻し（11バック中に6を出すと解除）

  // ターン操作
  fiveSkip: boolean;           // 5スキップ
  sevenPass: boolean;          // 7渡し
  tenDiscard: boolean;         // 10捨て
  nineReverse: boolean;        // 9リバース

  // 特殊効果
  queenBomber: boolean;        // クイーンボンバー
  downNumber: boolean;         // ダウンナンバー

  // 捨て札回収ルール
  salvage: boolean;            // サルベージ（3で場が流れた時に捨て札から1枚回収）
  kingsMarch: boolean;         // キングの行進（Kを出すと枚数分捨て札から回収）

  // 親権ルール
  nextAce: boolean;            // 次期エース（Aで場が流れた時に親になる）

  // ゲーム終了後のルール
  cityFall: boolean;           // 都落ち
  gekokujou: boolean;          // 下剋上
  luckySeven: boolean;         // ラッキーセブン
  catastrophe: boolean;        // 天変地異
}

/**
 * デフォルトルール設定
 * 全てのルールをONにする
 */
export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  eightCut: true,
  ambulance: true,
  rokurokubi: true,
  stairRevolution: true,
  nanasanRevolution: true,
  emperor: true,
  coup: true,
  greatRevolution: true,
  omen: true,
  forbiddenFinish: true,
  sandstorm: true,
  spadeThreeReturn: true,
  stairs: true,
  fourStop: true,
  suitLock: true,
  numberLock: true,
  strictLock: true,
  colorLock: true,
  queenRelease: true,
  sixReturn: true,
  fiveSkip: true,
  sevenPass: true,
  tenDiscard: true,
  nineReverse: true,
  queenBomber: true,
  downNumber: true,
  salvage: true,
  kingsMarch: true,
  nextAce: true,
  cityFall: true,
  gekokujou: true,
  luckySeven: true,
  catastrophe: true,
};
