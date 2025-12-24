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
      rules: [
        { key: 'eightCut', label: '8切り', description: '8を出すと場が流れる' },
        { key: 'ambulance', label: '救急車', description: '9x2で場が流れる' },
        { key: 'rokurokubi', label: 'ろくろ首', description: '6x2で場が流れる' },
      ]
    },
    {
      title: '革命バリエーション',
      rules: [
        { key: 'emperor', label: 'エンペラー', description: '4種マーク連番で革命' },
        { key: 'coup', label: 'クーデター', description: '9x3で革命' },
        { key: 'greatRevolution', label: '大革命', description: '2x4で革命＋即勝利' },
        { key: 'omen', label: 'オーメン', description: '6x3で革命＋以後革命なし' },
      ]
    },
    {
      title: '特殊勝利条件',
      rules: [
        { key: 'forbiddenFinish', label: '禁止上がり', description: 'J/2/8/Jokerで上がれない' },
      ]
    },
    {
      title: 'カード強度ルール',
      rules: [
        { key: 'sandstorm', label: '砂嵐', description: '3x3が何にでも勝つ' },
        { key: 'spadeThreeReturn', label: 'スぺ3返し', description: 'スペードの3がJokerに勝つ' },
        { key: 'stairs', label: '階段', description: '同じマークの連番' },
      ]
    },
    {
      title: 'フィールド効果',
      rules: [
        { key: 'fourStop', label: '4止め', description: '4x2で8切りを止める' },
        { key: 'suitLock', label: 'マークしばり', description: '同じマークで縛り' },
        { key: 'numberLock', label: '数字しばり', description: '連続する数字で縛り' },
      ]
    },
    {
      title: 'ターン操作',
      rules: [
        { key: 'fiveSkip', label: '5スキップ', description: '5で次のプレイヤーをスキップ' },
        { key: 'sevenPass', label: '7渡し', description: '7でカードを次のプレイヤーに渡す' },
        { key: 'tenDiscard', label: '10捨て', description: '10でカードを捨てる' },
        { key: 'nineReverse', label: '9リバース', description: '9でターン順を逆転' },
      ]
    },
    {
      title: '特殊効果',
      rules: [
        { key: 'queenBomber', label: 'クイーンボンバー', description: 'Qで全員がカードを捨てる' },
        { key: 'downNumber', label: 'ダウンナンバー', description: '同じマークで1つ下を出せる' },
      ]
    },
    {
      title: 'ゲーム終了後のルール',
      rules: [
        { key: 'cityFall', label: '都落ち', description: '大富豪が勝たないと大貧民に' },
        { key: 'gekokujou', label: '下剋上', description: '大貧民が勝つと全員のランクが逆転' },
        { key: 'luckySeven', label: 'ラッキーセブン', description: '7x3が無敗なら勝利' },
        { key: 'catastrophe', label: '天変地異', description: '貧民が10以下のカードのみでカード交換' },
      ]
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* パネル */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden pointer-events-auto">
              {/* ヘッダー */}
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">ルール設定</h2>
                <div className="flex gap-3">
                  <button
                    onClick={resetToDefault}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-bold"
                  >
                    デフォルトに戻す
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-bold"
                  >
                    閉じる
                  </button>
                </div>
              </div>

              {/* スクロール可能なコンテンツ */}
              <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
                <div className="space-y-6">
                  {ruleCategories.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="bg-white/10 rounded-lg p-4">
                      <h3 className="text-xl font-bold text-yellow-300 mb-3">
                        {category.title}
                      </h3>
                      <div className="space-y-2">
                        {category.rules.map((rule) => (
                          <label
                            key={rule.key}
                            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <div className="flex-1">
                              <div className="text-white font-bold">{rule.label}</div>
                              <div className="text-white/70 text-sm">{rule.description}</div>
                            </div>
                            <div className="ml-4">
                              <input
                                type="checkbox"
                                checked={settings[rule.key as keyof RuleSettings]}
                                onChange={(e) => updateSetting(rule.key as keyof RuleSettings, e.target.checked)}
                                className="w-6 h-6 text-yellow-500 bg-white/20 border-white/30 rounded focus:ring-2 focus:ring-yellow-500 cursor-pointer"
                              />
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
