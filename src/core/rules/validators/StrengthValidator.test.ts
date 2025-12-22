import { describe, it, expect } from 'vitest';
import { StrengthValidator } from './StrengthValidator';
import { CardFactory, Suit } from '../../domain/card/Card';
import { createPlayer, PlayerType } from '../../domain/player/Player';
import { Field } from '../../domain/game/Field';
import { PlayAnalyzer } from '../../domain/card/Play';

describe('StrengthValidator - XOR Logic', () => {
  const validator = new StrengthValidator();

  // テスト用プレイヤー
  const player = createPlayer('test-player', 'Test Player', PlayerType.CPU);

  describe('通常モード (革命なし、11バックなし)', () => {
    it('3 の上に 4 を出せる', () => {
      const field = new Field();
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');

      // 場に3を出す
      const play3 = PlayAnalyzer.analyze([card3])!;
      field.addPlay(play3, player.id);

      // 4を出す
      const cards = [card4];
      const context = { isRevolution: false, isElevenBack: false, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(true);
    });

    it('4 の上に 3 を出せない', () => {
      const field = new Field();
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card3 = CardFactory.create(Suit.SPADE, '3');

      // 場に4を出す
      const play4 = PlayAnalyzer.analyze([card4])!;
      field.addPlay(play4, player.id);

      // 3を出そうとする
      const cards = [card3];
      const context = { isRevolution: false, isElevenBack: false, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(false);
    });
  });

  describe('革命モード (革命あり、11バックなし)', () => {
    it('4 の上に 3 を出せる', () => {
      const field = new Field();
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card3 = CardFactory.create(Suit.SPADE, '3');

      // 場に4を出す
      const play4 = PlayAnalyzer.analyze([card4])!;
      field.addPlay(play4, player.id);

      // 3を出す（革命中なので弱い方が強い）
      const cards = [card3];
      const context = { isRevolution: true, isElevenBack: false, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(true);
    });

    it('3 の上に 4 を出せない', () => {
      const field = new Field();
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');

      // 場に3を出す
      const play3 = PlayAnalyzer.analyze([card3])!;
      field.addPlay(play3, player.id);

      // 4を出そうとする（革命中なので強い方が弱い）
      const cards = [card4];
      const context = { isRevolution: true, isElevenBack: false, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(false);
    });
  });

  describe('11バックモード (革命なし、11バックあり)', () => {
    it('4 の上に 3 を出せる', () => {
      const field = new Field();
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card3 = CardFactory.create(Suit.SPADE, '3');

      // 場に4を出す
      const play4 = PlayAnalyzer.analyze([card4])!;
      field.addPlay(play4, player.id);

      // 3を出す（11バック中なので弱い方が強い）
      const cards = [card3];
      const context = { isRevolution: false, isElevenBack: true, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(true);
    });

    it('3 の上に 4 を出せない', () => {
      const field = new Field();
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');

      // 場に3を出す
      const play3 = PlayAnalyzer.analyze([card3])!;
      field.addPlay(play3, player.id);

      // 4を出そうとする（11バック中なので強い方が弱い）
      const cards = [card4];
      const context = { isRevolution: false, isElevenBack: true, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(false);
    });
  });

  describe('革命+11バックモード (両方あり - XORで通常に戻る)', () => {
    it('3 の上に 4 を出せる (通常と同じ)', () => {
      const field = new Field();
      const card3 = CardFactory.create(Suit.SPADE, '3');
      const card4 = CardFactory.create(Suit.SPADE, '4');

      // 場に3を出す
      const play3 = PlayAnalyzer.analyze([card3])!;
      field.addPlay(play3, player.id);

      // 4を出す（両方activeなのでXORで通常に戻る）
      const cards = [card4];
      const context = { isRevolution: true, isElevenBack: true, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(true);
    });

    it('4 の上に 3 を出せない (通常と同じ)', () => {
      const field = new Field();
      const card4 = CardFactory.create(Suit.SPADE, '4');
      const card3 = CardFactory.create(Suit.SPADE, '3');

      // 場に4を出す
      const play4 = PlayAnalyzer.analyze([card4])!;
      field.addPlay(play4, player.id);

      // 3を出そうとする（両方activeなのでXORで通常に戻る）
      const cards = [card3];
      const context = { isRevolution: true, isElevenBack: true, field };

      const result = validator.validate(player, cards, context);
      expect(result.valid).toBe(false);
    });
  });

  describe('XOR真理値表の検証', () => {
    it('false XOR false = false (通常)', () => {
      const isRevolution: boolean = false;
      const isElevenBack: boolean = false;
      const shouldReverse = isRevolution !== isElevenBack;
      expect(shouldReverse).toBe(false);
    });

    it('false XOR true = true (反転)', () => {
      const isRevolution = false as boolean;
      const isElevenBack = true as boolean;
      const shouldReverse = isRevolution !== isElevenBack;
      expect(shouldReverse).toBe(true);
    });

    it('true XOR false = true (反転)', () => {
      const isRevolution = true as boolean;
      const isElevenBack = false as boolean;
      const shouldReverse = isRevolution !== isElevenBack;
      expect(shouldReverse).toBe(true);
    });

    it('true XOR true = false (通常)', () => {
      const isRevolution: boolean = true;
      const isElevenBack: boolean = true;
      const shouldReverse = isRevolution !== isElevenBack;
      expect(shouldReverse).toBe(false);
    });
  });
});
