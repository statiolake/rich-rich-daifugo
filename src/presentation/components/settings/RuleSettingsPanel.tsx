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
        { key: 'assassination', label: '暗殺', description: '2に対して3を出すと場が流れる（革命中は逆）' },
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
      ]
    },
    {
      title: '特殊勝利条件',
      icon: '🏆',
      rules: [
        { key: 'forbiddenFinish', label: '禁止上がり', description: 'J/2/8/Jokerで上がれない' },
      ]
    },
    {
      title: 'カード強度ルール',
      icon: '💪',
      rules: [
        { key: 'sandstorm', label: '砂嵐', description: '3x3が何にでも勝つ' },
        { key: 'tripleThreeReturn', label: '33返し', description: '3x3がジョーカー1枚を切れる' },
        { key: 'spadeThreeReturn', label: 'スぺ3返し', description: 'スペードの3がJokerに勝つ' },
        { key: 'spadeTwoReturn', label: 'スペ2返し', description: '革命中ジョーカーに対してスペード2で流せる' },
        { key: 'stairs', label: '階段', description: '同じマークの連番' },
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
        { key: 'queenRelease', label: 'Q解き', description: '縛り中にQを出すと縛り解除' },
        { key: 'sixReturn', label: '6戻し', description: '11バック中に6を出すと解除' },
      ]
    },
    {
      title: 'ターン操作',
      icon: '🔄',
      rules: [
        { key: 'fiveSkip', label: '5スキップ', description: '5で次のプレイヤーをスキップ' },
        { key: 'sevenPass', label: '7渡し', description: '7でカードを次のプレイヤーに渡す' },
        { key: 'tenDiscard', label: '10捨て', description: '10でカードを捨てる' },
        { key: 'nineReverse', label: '9リバース', description: '9でターン順を逆転' },
        { key: 'queenReverse', label: 'Qリバース', description: 'Qでターン順を逆転' },
        { key: 'kingReverse', label: 'Kリバース', description: 'Kでターン順を逆転' },
      ]
    },
    {
      title: '特殊効果',
      icon: '✨',
      rules: [
        { key: 'queenBomber', label: 'クイーンボンバー', description: 'Qで全員がカードを捨てる' },
        { key: 'downNumber', label: 'ダウンナンバー', description: '同じマークで1つ下を出せる' },
        { key: 'twoBack', label: '2バック', description: '2を出すと場が流れるまで強さ逆転' },
        { key: 'zombie', label: 'ゾンビ', description: '3x3で捨て札から次のプレイヤーに渡す' },
      ]
    },
    {
      title: '捨て札回収ルール',
      icon: '♻️',
      rules: [
        { key: 'salvage', label: 'サルベージ', description: '3で場が流れると捨て札から1枚回収' },
        { key: 'kingsMarch', label: 'キングの行進', description: 'Kを出すと枚数分捨て札から回収' },
      ]
    },
    {
      title: '親権ルール',
      icon: '👑',
      rules: [
        { key: 'nextAce', label: '次期エース', description: 'Aで場が流れた時に親になる' },
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
