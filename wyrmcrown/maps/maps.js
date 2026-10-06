/* WYRMCROWN — map registry and authoring helpers.
 * A map is pure data: size and seed, the four faction regions and their town
 * sites, authored geography (rivers, lakes, mountain ridges, forests, roads,
 * farmland), neutral objective sites with their guardians, wildlife herds and
 * power-up shrines. See maps/map01.js for the most complete example. */
'use strict';
(function (AS) {
  const Maps = {
    list: [], byId: {},
    add(m) {
      m.index = m.index || this.list.length + 1;
      this.list.push(m); this.byId[m.id] = m;
      return m;
    },
  };
  /* helpers used by map files */
  Maps.H = {
    // a straight road broken into gently wandering points (deterministic)
    road(a, b, wobble, seed) {
      const pts = [a];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 420));
      const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
      for (let i = 1; i < n; i++) {
        const t = i / n, w = (AS.U.hash2(i, seed || 1, 991) - 0.5) * 2 * (wobble || 120);
        pts.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + ny * w]);
      }
      pts.push(b);
      return { pts };
    },
  };
  AS.Maps = Maps;
})(window.AS);
