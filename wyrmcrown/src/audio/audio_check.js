/* WYRMCROWN — sound self-check.
 * The recordings and soundtrack live beside the code (wyrmcrown/audio/...). A copy
 * of the game without them still runs — sound effects fall back to a few
 * synthesized ones and the music stays silent — which is easy to mistake for a
 * bug. At start-up this asks the local server for one music track, one recorded
 * effect and one voice line, and if any is missing (or every volume is at zero)
 * says so plainly on screen. The result is kept in AS.AudioCheck.status. */
'use strict';
(function (AS) {
  const Check = {
    status: null, // { music, sfx, voice: true/false, quiet: bool }
    run() {
      if (!location.protocol.startsWith('http')) return; // file:// cannot ask (and cannot play recordings anyway)
      const M = AS.Data.music, R = AS.Data.recordings;
      const takes = (R && R.takes) || [];
      const probe = {
        music: M && M.tracks[M.start] && M.tracks[M.start].file,
        sfx: (takes.find((t) => t.kind === 'sfx') || {}).file,
        voice: (takes.find((t) => t.kind !== 'sfx' && t.kind !== 'audition') || {}).file,
      };
      const ask = (f) => (f ? fetch(f, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false) : Promise.resolve(true));
      Promise.all(Object.keys(probe).map((k) => ask(probe[k]).then((ok) => [k, ok]))).then((res) => {
        const st = Object.fromEntries(res);
        const S = AS.Settings || {};
        st.quiet = !(S.master > 0.01) || (!(S.music > 0.01) && !(S.sfx > 0.01));
        st.files = probe;
        this.status = st;
        const missing = Object.keys(probe).filter((k) => !st[k]);
        if (missing.length || st.quiet) this.show(missing, probe, st.quiet);
      });
    },
    show(missing, probe, quiet) {
      const box = document.createElement('div');
      box.id = 'audio-check';
      box.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;max-width:min(720px,92vw);' +
        'background:rgba(24,16,10,0.94);color:#f4e6c8;border:1px solid #c9a24a;border-radius:8px;padding:12px 16px 12px 16px;' +
        'font:15px/1.4 Georgia,serif;box-shadow:0 6px 24px rgba(0,0,0,0.5)';
      const names = { music: 'music', sfx: 'recorded sound effects', voice: 'recorded voices' };
      let html = '<b>Sound check</b><br>';
      if (missing.length) {
        html += 'This copy of the game cannot find its ' + missing.map((k) => names[k]).join(', ') + ' (looked for <code>wyrmcrown/' + probe[missing[0]] + '</code>). ' +
          'Start the game with <b>PLAY_GAME.cmd</b> from the folder that holds your recordings — the one with a <code>wyrmcrown\\audio</code> folder full of .mp3 files.';
      }
      if (quiet) html += (missing.length ? '<br>' : '') + 'Sound is turned down to nothing in Options — raise Master, Music and Sound Effects.';
      html += '<br><span style="opacity:.7;font-size:13px">Click the game once to enable sound. Click this note to close it.</span>';
      box.innerHTML = html;
      box.onclick = () => box.remove();
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 30000);
    },
  };
  AS.AudioCheck = Check;
})(window.AS);
