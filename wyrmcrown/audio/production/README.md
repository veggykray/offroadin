# Dragon Wars audio production

The source was imported from the supplied ZIP on 6 October 2026. Wyrmcrown is
the Dragon Wars game; `../alien-strike` is its shared engine.

The finished library contains 360 directed dialogue lines, 125 SFX and 50
audition takes. Fifteen superseded dialogue versions remain for comparison,
making 550 MP3 files in total. Gameplay selects the latest take of each line.
The review page shows final dialogue by default; enable "Compare earlier
takes" to hear the preserved originals.

Final checks passed: all 550 files freshly decoded with valid checksums and
peak headroom; all 360 dialogue jobs have recordings with the approved cast;
the browser played all eight voices through the shared mixer at rate 1;
all 125 SFX decoded; twelve prey-specific meals are distinct and 0.9 seconds.
Feeding, three combat checks, rare banter, victory/defeat and warning priority
checks passed. The final listening pass remains pending.

The latest transcript report covers every dialogue line. Two active text
boundary flags remain for ears: `elf_wizard_waygate_01` ("a waygate" read as
"away gate" by Scribe) and `human_wizard_spell_failure_01` ("spell stored" read
as "spells stored"). Repeated phrases and clearer word discrepancies were
retaken; originals are labelled as superseded, with the exact voices retained.

`cast.json` locks the user's eight audition choices: Julian, Lily, Ariana,
Declan, Smoke the Dragon, Callum, Victor and Bill. It never substitutes a voice
by display name. `approved-review.json` retains the user's selection evidence.
`pronunciation.json` is versioned; invented readings are editorial
choices inferred from spelling, not a claim about established lore.

Every generated file has a JSON sidecar containing the complete request,
generation time, response request ID, checksum and inspection state. Secrets
are read only from `ELEVENLABS_API_KEY`; they are never written to game files.
Keep generated takes: even the same parameters and seed are only best-effort
reproducible, and providers may update models or withdraw a library voice.

The bulk dialogue command refuses to run until all eight casting records have
an audition review, a selected candidate and `approved: true`. A successful API
response is not approval of intelligibility, humour, accent or pronunciation.

Open `tools/audio-review.html` through the local server to audition recordings.
For each candidate check quiet speech, sarcasm, urgent/shouted delivery,
names, consonants, longer phrasing, scale and fatigue after repeated listening.
Record specific weaknesses and regenerate a take rather than silently changing
the character's settings. Generated SFX also need a listening pass.

The agent cannot hear these clips in this session. Automated checks cover
decoding, duration, peak/clipping, checksums and transcript consistency. The
user approved casting after auditioning; individual production takes retain
their pending listening status. Transcript checks cannot judge acting or
confirm fantasy-name pronunciation. Original and revised takes are preserved.

Corrected names use Eleven v4's native slash-delimited IPA, alongside readable
pronunciation notes. Earlier dictionary versions and each take's full snapshot
are retained. The first cattle warning was retaken after its transcript read
"cackle"; the retake's transcript reads "cattle". This is text consistency
evidence, not a claim of a completed listening review.

Generation uses the installed ElevenLabs account without purchasing credits or
enabling overages. The generator checks available credits before each job and
stops on provider errors. It resumes from preserved files without charging for
existing takes. Read `tools/audio_generate.py --help` for commands.

Performance and reference guidance:
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert

Dragon/wizard exchanges share a global 180–300 second cooldown and a 90 second
initial quiet period. Routine callouts have separate cooldowns; town warnings
can interrupt chatter and escalate immediately when danger increases.

## Play and review

From the project root in PowerShell, run `./wyrmcrown/tools/play.ps1`, or run
`python wyrmcrown/tools/serve.py` and open the printed local URLs. Use HTTP so
the browser can fetch and decode recordings. The existing synth/browser voice
fallback remains available if an asset is unavailable.

Dragon and rider use the dragon's shared health in this game. Storm warnings
follow the weather state. Spell orbs hold charges; there is no separate rider
health or nightfall cycle to attach those requested reactions to.

To retake a line, keep the same locked cast and use
`python wyrmcrown/tools/audio_generate.py dialogue --only LINE_ID --take 2`.
Choose a new take number whenever a take already exists. The previous audio
and complete request remain available for comparison. After generation run
`python wyrmcrown/tools/audio_audit.py --decode --complete` and review the
resulting takes in the audition page's Dialogue tab.
