import { motion, AnimatePresence } from 'framer-motion';
import { useRuleSettingsStore } from '../../store/ruleSettingsStore';
import { RuleSettings } from '../../../core/domain/game/RuleSettings';

interface RuleSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleSettingsPanel: React.FC<RuleSettingsPanelProps> = ({ isOpen, onClose }) => {
  const settings = useRuleSettingsStore(state => state.settings);
  const updateSetting = useRuleSettingsStore(state => state.updateSetting);
  const resetToDefault = useRuleSettingsStore(state => state.resetToDefault);

  const ruleCategories = [
    {
      title: '場をクリアするルール',
      icon: '🔥',
      rules: [
        { key: 'eightCut', label: '8切り', description: '8を出すと場が流れる' },
        { key: 'fiveCut', label: '5切り', description: '革命中に5を出すと場が流れる' },
        { key: 'sixCut', label: '6切り', description: '革命中に6を出すと場が流れる' },
        { key: 'sevenCut', label: '7切り', description: '革命中に7を出すと場が流れる' },
        { key: 'ambulance', label: '救急車', description: '9x2で場が流れる' },
        { key: 'rokurokubi', label: 'ろくろ首', description: '6x2で場が流れる' },
        { key: 'dignity', label: '威厳', description: 'J-Q-Kの階段で場が流れる' },
      ]
    },
    {
      title: '革命バリエーション',
      icon: '⚔️',
      rules: [
        { key: 'stairRevolution', label: '階段革命', description: '4枚以上の階段で革命' },
        { key: 'nanasanRevolution', label: 'ナナサン革命', description: '7x3で革命' },
        { key: 'emperor', label: 'エンペラー', description: '4種マーク連番で革命' },
        { key: 'coup', label: 'クーデター', description: '9x3で革命' },
        { key: 'greatRevolution', label: '大革命', description: '2x4で革命＋即勝利' },
        { key: 'omen', label: 'オーメン', description: '6x3で革命＋以後革命なし' },
        { key: 'jokerRevolution', label: 'ジョーカー革命', description: 'ジョーカー2枚同時で革命' },
        { key: 'skipStairRevolution', label: '飛び連番革命', description: '等差数列の同スート4枚以上で革命' },
        { key: 'religiousRevolution', label: '宗教革命', description: 'Kx4でQ最強、A最弱＋偶奇縛り' },
        { key: 'superRevolution', label: '超革命', description: '5枚以上で革命、以降革命不可' },
        { key: 'revolutionFlow', label: '革命流し', description: '革命カードに8が含まれると8切り効果' },
        { key: 'fusionRevolution', label: '融合革命', description: '場札＋手札で4枚以上で革命' },
        { key: 'tsuiKaku', label: '追革', description: '場のペアと同数字ペアで革命' },
      ]
    },
    {
      title: '特殊勝利条件',
      icon: '🏆',
      rules: [
        { key: 'forbiddenFinish', label: '禁止上がり', description: 'J/2/8/Jokerで上がれない' },
        { key: 'taepodong', label: 'テポドン', description: '同数4枚＋Joker2枚で革命＋即上がり' },
        { key: 'monopoly', label: 'モノポリー', description: '同スートA〜K全13枚で即勝利' },
        { key: 'dokan', label: 'どかん', description: '場のカード合計=手札合計で即勝利' },
        { key: 'tenho', label: '天和', description: '配布時に手札が全てペアで即上がり' },
      ]
    },
    {
      title: 'カード強度ルール',
      icon: '💪',
      rules: [
        { key: 'sandstorm', label: '砂嵐', description: '3x3が何にでも勝つ' },
        { key: 'tripleThreeReturn', label: '33返し', description: '3x3がジョーカー1枚を切れる' },
        { key: 'assassination', label: '暗殺', description: '2に対して3を出すと場が流れる' },
        { key: 'spadeThreeReturn', label: 'スぺ3返し', description: 'スペードの3がJokerに勝つ' },
        { key: 'spadeTwoReturn', label: 'スペ2返し', description: '革命中Jokerに対してスペード2で流せる' },
        { key: 'stairs', label: '階段', description: '同じマークの連番' },
        { key: 'skipStair', label: '飛び階段', description: '同スートで公差がある3枚以上' },
        { key: 'doubleStair', label: '二列階段', description: '同ランク2枚ずつで階段' },
        { key: 'redSevenPower', label: 'レッドセブン', description: '通常時に♥7/♦7が2より強くJokerより弱い' },
        { key: 'blackSevenPower', label: 'ブラックセブン', description: '革命中に♠7/♣7が3より強くJokerより弱い' },
        { key: 'tunnel', label: 'トンネル', description: 'A→2→3の階段が最弱の階段' },
        { key: 'spadeStair', label: 'スペ階', description: '♠2→Joker→♠3の階段が最強で場が流れる' },
      ]
    },
    {
      title: 'フィールド効果',
      icon: '🌀',
      rules: [
        { key: 'fourStop', label: '4止め', description: '4x2で8切りを止める' },
        { key: 'suitLock', label: 'マークしばり', description: '同じマークで縛り' },
        { key: 'numberLock', label: '数字しばり', description: '連続する数字で縛り' },
        { key: 'strictLock', label: '激縛り', description: 'マーク+数字両方が同時に縛り' },
        { key: 'colorLock', label: '色縛り', description: '同じ色（赤/黒）が連続で縛り' },
        { key: 'partialLock', label: '片縛り', description: '複数枚で一部スートが一致で縛り' },
        { key: 'queenRelease', label: 'Q解き', description: '縛り中にQを出すと縛り解除' },
        { key: 'sixReturn', label: '6戻し', description: '11バック中に6を出すと解除' },
        { key: 'fiveColorLock', label: '5色縛り', description: '5を1枚出すとその色で縛り発動' },
      ]
    },
    {
      title: '偶数/奇数制限',
      icon: '🔢',
      rules: [
        { key: 'sevenCounter', label: '7カウンター', description: '8切り発生時にスペード7でキャンセル' },
        { key: 'evenRestriction', label: '偶数制限', description: '4を出すと場が流れるまで偶数のみ' },
        { key: 'oddRestriction', label: '奇数制限', description: '5を出すと場が流れるまで奇数のみ' },
      ]
    },
    {
      title: 'ターン操作',
      icon: '🔄',
      rules: [
        { key: 'fiveSkip', label: '5スキップ', description: '5で次のプレイヤーをスキップ' },
        { key: 'freemason', label: 'フリーメイソン', description: '6を1枚出すと次をスキップ' },
        { key: 'tenSkip', label: '10飛び', description: '10で次のプレイヤーをスキップ' },
        { key: 'tenFree', label: '10フリ', description: '10を出した後、次は何でも出せる' },
        { key: 'sevenPass', label: '7渡し', description: '7でカードを次のプレイヤーに渡す' },
        { key: 'sevenAttach', label: '7付け', description: '7を出すと枚数分追加で捨てる' },
        { key: 'nineReturn', label: '9戻し', description: '9を出すと直前プレイヤーにカードを渡す' },
        { key: 'tenDiscard', label: '10捨て', description: '10でカードを捨てる' },
        { key: 'nineReverse', label: '9リバース', description: '9でターン順を逆転' },
        { key: 'nineQuick', label: '9クイック', description: '9を出すと続けてもう1回出せる' },
        { key: 'queenReverse', label: 'Qリバース', description: 'Qでターン順を逆転' },
        { key: 'kingReverse', label: 'Kリバース', description: 'Kでターン順を逆転' },
        { key: 'kingPastor', label: 'キング牧師', description: 'Kを出すと全員が右隣に1枚渡す' },
        { key: 'reKing', label: 'Re:KING', description: 'Kを出すと全員が捨て札からK枚数分引く' },
      ]
    },
    {
      title: '特殊効果',
      icon: '✨',
      rules: [
        { key: 'queenBomber', label: 'クイーンボンバー', description: 'Qで全員がカードを捨てる' },
        { key: 'jeanneDArc', label: 'ジャンヌダルク', description: 'Qx3で次のプレイヤーが最強2枚を捨てる' },
        { key: 'bloodyMary', label: 'ブラッディメアリ', description: 'Qx3で全員が最強2枚を捨てる' },
        { key: 'downNumber', label: 'ダウンナンバー', description: '同じマークで1つ下を出せる' },
        { key: 'twoBack', label: '2バック', description: '2を出すと場が流れるまで強さ逆転' },
        { key: 'zombie', label: 'ゾンビ', description: '3x3で捨て札から次のプレイヤーに渡す' },
        { key: 'enhancedJBack', label: '強化Jバック', description: 'Jx3で11バックが2回流れるまで持続' },
        { key: 'damian', label: 'ダミアン', description: '6x3で場が流れるまでパスした人は敗北' },
        { key: 'death', label: 'DEATH', description: '4x3で全員が最強カードを捨てる' },
        { key: 'thief', label: 'シーフ', description: '4x3で次のプレイヤーから最強を奪う' },
        { key: 'nero', label: 'ネロ', description: 'Kx3で各対戦相手から最強1枚ずつ奪う' },
        { key: 'kingsPrivilege', label: '王の特権', description: 'Kx3で左隣と手札を全交換' },
        { key: 'arthur', label: 'アーサー', description: 'Kx3でJokerが10〜Jの間の強さになる' },
        { key: 'doubleKing', label: 'ダブルキング', description: 'Kx2がK以下のペアとして出せる' },
      ]
    },
    {
      title: '捨て札回収ルール',
      icon: '♻️',
      rules: [
        { key: 'salvage', label: 'サルベージ', description: '3で場が流れると捨て札から1枚回収' },
        { key: 'kingsMarch', label: 'キングの行進', description: 'Kを出すと枚数分捨て札から回収' },
        { key: 'satan', label: 'サタン', description: '6x3で捨て札から任意カード1枚回収' },
        { key: 'chestnutPicking', label: '栗拾い', description: '9を出すと枚数分だけ捨て札から回収' },
        { key: 'galaxyExpress999', label: '銀河鉄道999', description: '9x3で手札2枚捨て、捨て札から2枚引く' },
        { key: 'blackSeven', label: '黒7', description: '♠7/♣7を出すと枚数分捨て札からランダムに引く' },
        { key: 'tyrant', label: '暴君', description: '2を出すと自分以外が捨て札から1枚引く' },
        { key: 'resurrection', label: '死者蘇生', description: '4を出すと直前のカードを枚数分手札に加える' },
      ]
    },
    {
      title: 'ジョーカー関連',
      icon: '🃏',
      rules: [
        { key: 'jokerReturn', label: 'ジョーカー返し', description: 'Joker1枚に対してもう1枚のJokerを重ねて出せる' },
        { key: 'jokerSeize', label: 'ジョーカー請求', description: '4を出すと次のプレイヤーからJokerを奪う' },
        { key: 'crusade', label: '十字軍', description: '10x4で革命＋全Jokerを奪う' },
        { key: 'auction', label: 'オークション', description: '10x3でJoker所持者から1枚奪う' },
      ]
    },
    {
      title: '親権ルール',
      icon: '👑',
      rules: [
        { key: 'nextAce', label: '次期エース', description: 'Aで場が流れた時に親になる' },
        { key: 'finishFlow', label: '上がり流し', description: 'プレイヤーが上がった時に場が流れる' },
        { key: 'aceTax', label: 'A税収', description: '子がAを出すと直前カードを回収、次をスキップ' },
      ]
    },
    {
      title: 'ゲーム終了後のルール',
      icon: '🎮',
      rules: [
        { key: 'cityFall', label: '都落ち', description: '大富豪が勝たないと大貧民に' },
        { key: 'gekokujou', label: '下剋上', description: '大貧民が勝つと全員のランクが逆転' },
        { key: 'luckySeven', label: 'ラッキーセブン', description: '7x3が無敗なら勝利' },
        { key: 'catastrophe', label: '天変地異', description: '貧民が10以下のカードのみでカード交換' },
      ]
    },
    {
      title: '都落ち派生ルール',
      icon: '🏯',
      rules: [
        { key: 'kyoOchi', label: '京落ち', description: '大富豪が連続1着で富豪が大貧民に' },
        { key: 'fuOchi', label: '府落ち', description: '都落ち＋富豪が2着でない→富豪も貧民に' },
        { key: 'reparations', label: '賠償金', description: '都落ち後も継続で先に上がった人と追加交換' },
        { key: 'babaOchi', label: 'ババ落ち', description: 'Joker含む5枚革命でもう1枚のJoker所持者敗北' },
        { key: 'nuclearBomb', label: '核爆弾', description: '6枚以上で革命→ゲーム終了まで革命固定' },
        { key: 'murahachibu', label: '村八分', description: '都落ち後、9以上のカード没収' },
        { key: 'adauchiBan', label: '仇討ち禁止令', description: '都落ちさせた相手を都落ちさせて上がれない' },
        { key: 'securityLaw', label: '治安維持法', description: '都落ちプレイヤーは革命を起こせない' },
      ]
    },
    {
      title: '交換枚数バリエーション',
      icon: '🔃',
      rules: [
        { key: 'absoluteMonarchy', label: '絶対王政', description: '富豪1枚、貧民2枚、大貧民3枚を献上' },
        { key: 'monarchyDefense', label: '王政防衛', description: '連続大富豪で交換枚数が増加' },
        { key: 'antiMonopoly', label: '独占禁止法', description: '大富豪に2とJokerが5枚以上で2を配布' },
        { key: 'inheritanceTax', label: '相続税', description: '連続大富豪で交換枚数が3→4→5枚と増加' },
        { key: 'blindExchange', label: '伏せ交換', description: '貧民が裏向きで並べ、富豪が任意位置から抜く' },
      ]
    },
    {
      title: '情報公開ルール',
      icon: '👁️',
      rules: [
        { key: 'fivePick', label: '5ピック', description: '5を出すと枚数分だけ好きな人の手札を見れる' },
        { key: 'weakShow', label: '弱見せ', description: '9を出すと次のプレイヤーの最弱カードを公開' },
        { key: 'strongShow', label: '強見せ', description: '6を出すと次のプレイヤーの最強カードを公開' },
      ]
    },
    {
      title: '出せるカード制限',
      icon: '🚫',
      rules: [
        { key: 'doubleDigitSeal', label: '2桁封じ', description: '6を出すと場が流れるまでJ〜Kが出せない' },
        { key: 'hotMilk', label: 'ホットミルク', description: '3の上に9を出すとダイヤ/ハートのみ出せる' },
      ]
    },
    {
      title: 'Qラブ・手札交換',
      icon: '💕',
      rules: [
        { key: 'queenLove', label: 'Qラブ', description: 'Q（階段以外）を出すと枚数分捨て札から回収＋連続ターン' },
        { key: 'redFive', label: '赤い5', description: '♥5/♦5を1枚出すと指名者と手札シャッフル再配布' },
        { key: 'gloriousRevolution', label: '名誉革命', description: '4x4で革命せず、大富豪を大貧民に転落' },
        { key: 'blackMarket', label: '闇市', description: 'Ax3で指名者と任意2枚⇔最強2枚を交換' },
      ]
    },
    {
      title: '特殊効果ルール（4枚系）',
      icon: '4️⃣',
      rules: [
        { key: 'industrialRevolution', label: '産業革命', description: '3x4で全員の手札を見て1人1枚ずつ回収' },
        { key: 'deathSentence', label: '死の宣告', description: '4x4で指名者は以降パスすると敗北' },
        { key: 'aceJanaiKa', label: 'Aじゃないか', description: 'Ax4でゲーム終了、全員平民に' },
      ]
    },
    {
      title: '特殊出しルール',
      icon: '🎴',
      rules: [
        { key: 'crossDressing', label: '女装', description: 'Qを出す時、同枚数のKも一緒に出せる' },
      ]
    },
    {
      title: '9系ルール',
      icon: '9️⃣',
      rules: [
        { key: 'nineGamble', label: '9賭け', description: '9を出すと指名者がランダムで手札を1枚捨てる' },
        { key: 'nineShuffle', label: '9シャッフル', description: '9x2で対戦相手の席順を自由に変更' },
      ]
    },
    {
      title: 'カード請求ルール',
      icon: '🎁',
      rules: [
        { key: 'sixClaim', label: '6もらい', description: '6を出すと指名者にカード宣言、持っていれば貰える' },
        { key: 'nineClaim', label: '9もらい', description: '9を出すと指名者に欲しいカードを宣言、持っていれば貰う' },
      ]
    },
    {
      title: 'カウントダウン系ルール',
      icon: '⏱️',
      rules: [
        { key: 'endCountdown', label: '終焉のカウントダウン', description: '大貧民が4x1を出すとカウントダウン開始' },
        { key: 'teleforce', label: 'テレフォース', description: '4x1を出すと7ターン後に全員敗北' },
        { key: 'guillotineClock', label: 'ギロチン時計', description: '4を出すとカウントダウン開始' },
      ]
    },
    {
      title: '8切り関連ルール',
      icon: '8️⃣',
      rules: [
        { key: 'yagiriNoWatashi', label: '矢切の渡し', description: '8を出すと8切り＋任意プレイヤーにカードを渡せる' },
        { key: 'eightCounter', label: '8切り返し', description: '8切り発生時に他プレイヤーが8を重ねて自分の番に' },
        { key: 'tenCounter', label: '10返し', description: '8切り発生時、同スートの10で8切り無効化' },
        { key: 'enhancedEightCut', label: '強化8切り', description: '8x3で場のカードをゲームから完全除外' },
      ]
    },
    {
      title: '語呂合わせ革命',
      icon: '📝',
      rules: [
        { key: 'southernCross', label: 'サザンクロス', description: '3,3,9,6を同時出しで革命（3396）' },
        { key: 'heiankyoFlow', label: '平安京流し', description: '同スート7,9,4でいつでも出せて場が流れる（794）' },
        { key: 'cyclone', label: 'サイクロン', description: '同スート3,A,9,6で全員の手札を混ぜて再配布（3196）' },
        { key: 'konagonaRevolution', label: '粉々革命', description: '同色5×2枚、7×2枚で出した人が大富豪（5757）' },
        { key: 'yoroshikuRevolution', label: '世露死苦革命', description: '4,6,4,9を出すと革命（4649）' },
        { key: 'shininasaiRevolution', label: '死になさい革命', description: '♠4,2,7,3,Aで革命＋指名者を大貧民に（42731）' },
      ]
    },
    {
      title: '開始・終了ルール',
      icon: '🚀',
      rules: [
        { key: 'diamond3Start', label: 'ダイヤ3スタート', description: 'ダイヤ3所持者が親、最初にダイヤ3を含める' },
        { key: 'daifugoLeisure', label: '大富豪の余裕', description: '大富豪は最初の1手で必ずパス' },
        { key: 'shiminByodo', label: '四民平等', description: '1ゲーム中に革命が4回以上で全員平民に' },
      ]
    },
    {
      title: '開始ルール（配布系）',
      icon: '🎲',
      rules: [
        { key: 'discriminatoryDeal', label: '差別配り', description: '階級に応じて配布枚数を増減' },
        { key: 'blindCard', label: 'ブラインドカード', description: '端数分のカードを抜いて伏せておく' },
        { key: 'trump', label: '切り札/ドラ', description: '配布時に1枚伏せてその数字が最強に' },
      ]
    },
    {
      title: 'カード操作系ルール',
      icon: '🎯',
      rules: [
        { key: 'guerrilla', label: 'ゲリラ兵', description: '場のカードと同数字を多く持つ時、捨て札に直接送れる' },
        { key: 'catapult', label: 'カタパルト', description: '場のカードと同数字を追加で出し、4枚以上で革命' },
        { key: 'spadeCounter', label: 'スペード返し', description: '特殊効果発動時に同数字スペードでキャンセル' },
        { key: 'bananaIce', label: 'バナナアイス', description: '同色6枚の階段は直接捨て札に送れる' },
      ]
    },
    {
      title: '大貧民特殊ルール',
      icon: '😢',
      rules: [
        { key: 'supplyAid', label: '物資救援', description: '大貧民が1回限りで場のカード全てを手札に加え親になる' },
        { key: 'scavenging', label: '拾い食い', description: '大富豪のカード出し時、大貧民が1回限りで拾える' },
        { key: 'cartel', label: 'カルテル', description: '大貧民が3-4-5の階段で大富豪以外の手札を公開' },
      ]
    },
  ];

  // Count enabled rules
  const enabledCount = Object.values(settings).filter(Boolean).length;
  const totalCount = Object.keys(settings).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
          >
            <div className="game-panel w-full max-w-4xl max-h-[90vh] overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="game-panel-header flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-white tracking-wide">ルール設定</h2>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/80">
                    {enabledCount}/{totalCount} 有効
                  </span>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetToDefault}
                    className="game-btn-secondary text-sm py-2"
                  >
                    デフォルトに戻す
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="game-btn-danger text-sm py-2"
                  >
                    閉じる
                  </motion.button>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6 custom-scrollbar">
                <div className="space-y-6">
                  {ruleCategories.map((category, categoryIndex) => (
                    <motion.div
                      key={categoryIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: categoryIndex * 0.05 }}
                      className="game-card"
                    >
                      <h3 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-3">
                        <span className="text-2xl">{category.icon}</span>
                        {category.title}
                        <span className="text-sm font-normal text-white/50">
                          ({category.rules.filter(r => settings[r.key as keyof RuleSettings]).length}/{category.rules.length})
                        </span>
                      </h3>
                      <div className="grid gap-2">
                        {category.rules.map((rule, ruleIndex) => {
                          const isEnabled = settings[rule.key as keyof RuleSettings];
                          return (
                            <motion.label
                              key={rule.key}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: categoryIndex * 0.05 + ruleIndex * 0.02 }}
                              className={`
                                flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer
                                ${isEnabled
                                  ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30'
                                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                }
                              `}
                            >
                              <div className="flex-1">
                                <div className={`font-bold ${isEnabled ? 'text-yellow-300' : 'text-white'}`}>
                                  {rule.label}
                                </div>
                                <div className="text-white/60 text-sm">{rule.description}</div>
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) => updateSetting(rule.key as keyof RuleSettings, e.target.checked)}
                                  className="game-checkbox"
                                />
                              </div>
                            </motion.label>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Footer note */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30"
                >
                  <p className="text-center text-white/80 text-sm">
                    <span className="text-purple-300 font-bold">ヒント:</span> ルールを多く有効にするほどカオスで楽しくなります！
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
