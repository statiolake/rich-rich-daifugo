import { ValidationRule } from '../base/ValidationRule';
import { HandOwnershipRule } from './HandOwnershipRule';
import { ValidCombinationRule } from './ValidCombinationRule';
import { StrongerPlayRule } from './StrongerPlayRule';

/**
 * 通常ルールのセット
 */
export function createNormalRules(): ValidationRule[] {
  return [
    new HandOwnershipRule(),
    new ValidCombinationRule(),
    new StrongerPlayRule(),
  ];
}
