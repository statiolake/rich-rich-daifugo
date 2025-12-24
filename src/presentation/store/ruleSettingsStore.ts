import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RuleSettings, DEFAULT_RULE_SETTINGS } from '../../core/domain/game/RuleSettings';

interface RuleSettingsStore {
  settings: RuleSettings;
  updateSetting: (key: keyof RuleSettings, value: boolean) => void;
  resetToDefault: () => void;
}

export const useRuleSettingsStore = create<RuleSettingsStore>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_RULE_SETTINGS },

      updateSetting: (key, value) => {
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        }));
      },

      resetToDefault: () => {
        set({ settings: { ...DEFAULT_RULE_SETTINGS } });
      },
    }),
    {
      name: 'daifugo-rule-settings',
    }
  )
);
