/* ALIEN STRIKE — derive craft & weapon stats from the campaign profile. */
'use strict';
(function (AS) {
  const Stats = {
    lv(p, id) { return (p && p.upgrades && p.upgrades[id]) || 0; },
    compute(profile) {
      const L = (id) => this.lv(profile, id);
      const s = {
        hullMax: 100 + L('armor') * 20,
        shieldMax: 60 + L('shield') * 15,
        shieldRegen: 14 * (1 + L('shieldRegen') * 0.25),
        shieldDelay: 3.0 - L('shieldRegen') * 0.4,
        fuelMax: 100 * (1 + L('fuelCap') * 0.2),
        fuelBurn: Math.pow(0.9, L('fuelEff')),
        maxSpeed: 235 * (1 + L('speed') * 0.07),
        accel: 560 * (1 + L('speed') * 0.07),
        turnRate: 3.3 * (1 + L('turning') * 0.15),
        strafe: 0.72 * (1 + L('turning') * 0.1),
        cargoCap: 2 + L('cargo'),
        rescueCap: 4 + L('rescue') * 2,
        scanLevel: L('scanner'),
        scanRange: 820 * (1 + L('scanner') * 0.25),
        kitCap: 1 + L('kits'),
      };
      const W = AS.Data.weapons;
      const lo = profile.loadout;
      const pri = Object.assign({}, W[lo.primary] || W.pulse);
      pri.id = lo.primary;
      pri.dmgMul = 1 + L('pDamage') * 0.15;
      pri.rateMul = 1 + L('pRate') * 0.12;
      pri.coolMul = 1 + L('pHeat') * 0.25;
      pri.heatMul = Math.pow(0.85, L('pHeat'));
      pri.barrels = 1 + L('pSpread');
      pri.ammoMax = Math.round(pri.ammo * (1 + L('pAmmo') * 0.25));
      const sec = Object.assign({}, W[lo.secondary] || W.missile);
      sec.id = lo.secondary;
      sec.dmgMul = 1 + L('sDamage') * 0.18;
      sec.lockMul = Math.pow(0.8, L('sLock'));
      sec.splashMul = 1 + L('sSplash') * 0.2;
      sec.ammoMax = Math.round(sec.ammo * (1 + L('sAmmo') * 0.25));
      sec.multi = (sec.multi || 1) + L('sMulti');
      const spc = Object.assign({}, W[lo.special] || W.plasma);
      spc.id = lo.special;
      spc.ammoMax = spc.ammo + L('xCharges');
      spc.radiusMul = 1 + L('xRadius') * 0.15;
      spc.dmgMul = 1 + L('xDamage') * 0.2;
      spc.cdMul = Math.pow(0.85, L('xCooldown'));
      s.primary = pri; s.secondary = sec; s.special = spc;
      return s;
    },
  };
  AS.Stats = Stats;
})(window.AS);
