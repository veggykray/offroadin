class_name TendingSequence
extends Node
## The hidden puzzle. Five stages the player must discover purely from the
## beast's behaviour:
##   1 TRUST        slow strokes along the Soft Fold
##   2 DISCOVERY    the Great Flap unfolds; scratch its downy underside
##   3 RHYTHM       the nodules pulse; tap them in time
##   4 COMBINATION  fur scratch -> flap rub -> whisker sweep, twice, following
##                  where the beast directs its attention
##   5 FINISH       keep scratching the fur at the pace it wants, not too fast,
##                  not too slow, while everything escalates
## The Mystery Crevice is a red herring.

enum Stage { INTRO, TRUST, DISCOVERY, RHYTHM, COMBINATION, FINISH, CLIMAX, AFTERGLOW, DONE }
const STAGE_NAMES := ["intro", "1 trust", "2 discovery", "3 rhythm", "4 combination", "5 finish", "climax", "afterglow", "done"]

signal stage_changed(stage: int)
signal combo_step_changed(region_id: StringName)
signal finished

@export_group("Hints")
## Seconds without progress before the beast starts physically hinting.
@export var hint_delay := 22.0
@export var hint_repeat := 3.5

@export_group("Stage 1: Trust")
@export var trust_speed := 260.0
@export var trust_speed_tolerance := 0.75
@export var trust_too_fast := 1100.0
@export var trust_seconds := 4.5

@export_group("Stage 2: Discovery")
@export var discovery_speed := 550.0
@export var discovery_seconds := 3.5

@export_group("Stage 3: Rhythm")
@export var beat_interval := 0.62
## Seconds either side of a beat that still count as "in time".
@export var beat_tolerance := 0.14
@export var rhythm_hits := 8

@export_group("Stage 4: Combination")
@export var combo_cycles := 2
@export var combo_step_seconds := 1.4
@export var combo_whisker_seconds := 0.8

@export_group("Stage 5: Finish")
@export var finish_speed_start := 430.0
@export var finish_speed_end := 720.0
## Ratio band around the wanted speed: 0.6 means /1.6 .. x1.6 is fine.
@export var finish_tolerance := 0.6
@export var finish_seconds := 10.0
@export var finish_cooldown_rate := 0.035

var stage: int = Stage.INTRO
var progress := 0.0
var stage_time := 0.0
var idle_time := 0.0
var beat_clock := 0.0
var rhythm_streak := 0.0
var _last_beat_tap := -100.0
var combo_index := 0
var combo_progress := 0.0
var herring_count := 0
var finish_state := 0      ## -1 too slow, 0 none, 1 in band, 2 too fast
var finish_good_time := 0.0
var last_judgement := ""
var _hint_timer := 0.0
var _impatient_cd := 0.0
var _climax_events := {}
var _finish_feedback_cd := 0.0

var COMBO_STEPS := [
	{"region": &"fur", "type": Gesture.Type.SCRATCH, "speed": 550.0, "tol": 0.95},
	{"region": &"flap", "type": Gesture.Type.RUB, "speed": 350.0, "tol": 0.95},
	{"region": &"whiskers", "type": Gesture.Type.STROKE, "speed": 650.0, "tol": 1.0},
]


func _ready() -> void:
	Game.sequence = self


func begin() -> void:
	herring_count = 0
	combo_index = 0
	combo_progress = 0.0
	_climax_events.clear()
	var crev := Game.region(&"crevice")
	if crev:
		crev.reset_state()
	_set_stage(Stage.TRUST)


# --- Queries used by the rest of the game ----------------------------------------

func satisfaction() -> float:
	if stage <= Stage.INTRO:
		return 0.0
	if stage >= Stage.CLIMAX:
		return 1.0
	return clampf((stage - Stage.TRUST + progress) / 5.0, 0.0, 1.0)


func base_escalation() -> float:
	match stage:
		Stage.TRUST: return progress * 0.1
		Stage.DISCOVERY: return 0.12 + progress * 0.12
		Stage.RHYTHM: return 0.26 + progress * 0.14
		Stage.COMBINATION: return 0.42 + progress * 0.16
		Stage.FINISH: return 0.6 + progress * 0.38
		Stage.CLIMAX: return 1.0
	return 0.0


func is_impatient() -> bool:
	return stage >= Stage.TRUST and stage <= Stage.FINISH and idle_time > hint_delay


func fold_warmth() -> float:
	if stage == Stage.TRUST:
		return progress * 0.7
	return 0.7 if stage > Stage.TRUST and stage < Stage.AFTERGLOW else 0.3


## 0..1 sharp pulse on each nodule beat.
func beat_pulse() -> float:
	if stage < Stage.RHYTHM or stage >= Stage.AFTERGLOW:
		return 0.0
	var ph := fposmod(beat_clock, beat_interval) / beat_interval
	var k := exp(-ph * 6.0) + exp(-(1.0 - ph) * 30.0) * 0.4
	return clampf(k, 0.0, 1.0) * (0.6 if stage == Stage.COMBINATION else 1.0)


func current_target() -> BodyRegion:
	match stage:
		Stage.TRUST: return Game.region(&"fold")
		Stage.DISCOVERY: return Game.region(&"flap")
		Stage.RHYTHM: return Game.region(&"nodules")
		Stage.COMBINATION: return Game.region(COMBO_STEPS[combo_index % 3].region)
		Stage.FINISH: return Game.region(&"fur")
	return null


# --- Judgement -----------------------------------------------------------------------

## Decide how the beast feels about this touch, and advance the puzzle.
func judge(region: BodyRegion, g: Gesture) -> int:
	if stage < Stage.TRUST or stage >= Stage.CLIMAX:
		return Game.Level.NEUTRAL
	if region.region_id == &"crevice":
		return _judge_crevice(region, g)
	var level: int
	match stage:
		Stage.TRUST: level = _judge_trust(region, g)
		Stage.DISCOVERY: level = _judge_discovery(region, g)
		Stage.RHYTHM: level = _judge_rhythm(region, g)
		Stage.COMBINATION: level = _judge_combination(region, g)
		Stage.FINISH: level = _judge_finish(region, g)
		_: level = Game.Level.NEUTRAL
	last_judgement = "%s on %s -> %s" % [Gesture.type_name(g.type), region.region_id, Game.LEVEL_NAMES[level]]
	return level


## Touching bare hide between regions.
func judge_bare(g: Gesture) -> int:
	if stage < Stage.TRUST or stage >= Stage.CLIMAX:
		return Game.Level.NEUTRAL
	if g.type == Gesture.Type.POKE and stage <= Stage.DISCOVERY:
		return Game.Level.WRONG
	if g.type == Gesture.Type.SCRATCH and stage == Stage.TRUST:
		return Game.Level.WRONG
	return Game.Level.NEUTRAL


func _generic(region: BodyRegion, g: Gesture) -> int:
	if g.type == Gesture.Type.RHYTHM:
		return Game.Level.NEUTRAL
	var liked := region.evaluate(g)
	if liked < 0.0:
		return Game.Level.WRONG
	if stage == Stage.TRUST and (g.type == Gesture.Type.POKE or g.type == Gesture.Type.SCRATCH):
		return Game.Level.WRONG  # still wary of sudden contact
	if liked >= 0.7:
		return Game.Level.CLOSE
	if g.type == Gesture.Type.POKE and stage <= Stage.DISCOVERY:
		return Game.Level.WRONG
	return Game.Level.NEUTRAL


func _level_from(score: float) -> int:
	if score >= 0.8:
		return Game.Level.VERY_GOOD if (progress > 0.5 or stage >= Stage.COMBINATION) else Game.Level.GOOD
	if score >= 0.5:
		return Game.Level.GOOD
	if score >= 0.25:
		return Game.Level.CLOSE
	return Game.Level.NEUTRAL


func _judge_trust(region: BodyRegion, g: Gesture) -> int:
	if region.region_id != &"fold":
		return _generic(region, g)
	match g.type:
		Gesture.Type.STROKE:
			if g.speed > trust_too_fast:
				return Game.Level.WRONG
			var s := region.score_against(g, Gesture.Type.STROKE, trust_speed, trust_speed_tolerance,
				-1.0, 0.4, Vector2(1, 0), 0.7)
			_add_progress(g.dt * s / trust_seconds)
			return _level_from(s)
		Gesture.Type.HOLD:
			return Game.Level.CLOSE
		Gesture.Type.RUB:
			return Game.Level.CLOSE if g.speed < 600.0 else Game.Level.WRONG
	return _generic(region, g)


func _judge_discovery(region: BodyRegion, g: Gesture) -> int:
	if region.region_id == &"fold" and g.type == Gesture.Type.STROKE and g.speed < trust_too_fast:
		return Game.Level.CLOSE  # still nice, but it wants something new
	if region.region_id != &"flap":
		return _generic(region, g)
	if g.type == Gesture.Type.POKE:
		return Game.Level.WRONG
	var zone: StringName = region.zone_at(g.world_pos)
	if zone == &"underside":
		if g.type == Gesture.Type.SCRATCH:
			var s := region.score_against(g, Gesture.Type.SCRATCH, discovery_speed, 0.9)
			_add_progress(g.dt * s / discovery_seconds)
			return _level_from(maxf(s, 0.5))
		if g.type == Gesture.Type.RUB:
			_add_progress(g.dt * 0.15 / discovery_seconds)
			return Game.Level.CLOSE
		return Game.Level.NEUTRAL
	if zone == &"base" and g.type == Gesture.Type.RUB:
		return Game.Level.CLOSE
	return _generic(region, g)


func _judge_rhythm(region: BodyRegion, g: Gesture) -> int:
	if region.region_id != &"nodules":
		return _generic(region, g)
	match g.type:
		Gesture.Type.RHYTHM:
			return Game.Level.NEUTRAL
		Gesture.Type.POKE:
			if g.interval > 0.0 and g.interval < 0.24 and g.tap_count >= 2:
				rhythm_streak = 0.0
				return Game.Level.WRONG  # frantic jabbing
			var err := _beat_error()
			var since := stage_time - _last_beat_tap
			if err <= beat_tolerance:
				# Only a steady pulse counts: the previous on-beat tap must be
				# one or two beats ago.
				var beats := since / beat_interval
				var steady := absf(beats - roundf(beats)) * beat_interval <= beat_tolerance * 1.6 and roundf(beats) >= 1.0 and roundf(beats) <= 2.0
				_last_beat_tap = stage_time
				if steady:
					rhythm_streak += 1.0
					_add_progress(1.0 / rhythm_hits)
					if Game.terrain:
						Game.terrain.add_ripple(g.world_pos, 0.5 + minf(rhythm_streak, 6.0) * 0.12)
					return Game.Level.VERY_GOOD if rhythm_streak >= 3.0 else Game.Level.GOOD
				rhythm_streak = 0.0
				return Game.Level.CLOSE
			rhythm_streak = 0.0
			progress = maxf(progress - 0.5 / rhythm_hits, 0.0)
			return Game.Level.CLOSE
	return _generic(region, g)


func _beat_error() -> float:
	var ph := fposmod(beat_clock, beat_interval)
	return minf(ph, beat_interval - ph)


func _judge_combination(region: BodyRegion, g: Gesture) -> int:
	var step: Dictionary = COMBO_STEPS[combo_index % 3]
	if region.region_id == step.region:
		if region.region_id == &"flap" and g.type == Gesture.Type.POKE:
			return Game.Level.WRONG
		var s := region.score_against(g, step.type, step.speed, step.tol)
		var need := combo_whisker_seconds if step.region == &"whiskers" else combo_step_seconds
		if s > 0.3:
			combo_progress += g.dt * s / need
			idle_time = 0.0
			if combo_progress >= 1.0:
				_next_combo_step(region, g.world_pos)
				if stage != Stage.COMBINATION:
					return Game.Level.VERY_GOOD
			progress = (combo_index + clampf(combo_progress, 0.0, 1.0)) / float(combo_cycles * 3)
			return Game.Level.VERY_GOOD if s > 0.7 else Game.Level.GOOD
		return _generic(region, g)
	var level := _generic(region, g)
	if level == Game.Level.CLOSE and _impatient_cd <= 0.0:
		# Nice, but not where it wants you right now.
		_impatient_cd = 3.0
		if Game.body:
			Game.body.hint(current_target(), 0.8)
	return level


func _next_combo_step(region: BodyRegion, pos: Vector2) -> void:
	combo_index += 1
	combo_progress = 0.0
	if Game.body:
		Game.body.present(Game.Level.VERY_GOOD, null, pos, null)
		Game.body.thump(0.6 + combo_index * 0.08)
	if combo_index >= combo_cycles * 3:
		_set_stage(Stage.FINISH)
		return
	var next := current_target()
	combo_step_changed.emit(next.region_id)
	if Game.body:
		Game.body.hint(next, 0.75)


func _judge_finish(region: BodyRegion, g: Gesture) -> int:
	if region.region_id != &"fur":
		return _generic(region, g)
	if g.type != Gesture.Type.SCRATCH and g.type != Gesture.Type.RUB:
		return _generic(region, g)
	var want := lerpf(finish_speed_start, finish_speed_end, progress)
	var ratio := g.speed / want
	_finish_feedback_cd -= g.dt
	if ratio < 1.0 / (1.0 + finish_tolerance):
		finish_state = -1
		progress = maxf(progress - g.dt * 0.04, 0.0)
		if _finish_feedback_cd <= 0.0 and Game.voice:
			_finish_feedback_cd = 1.8
			Game.voice.play_at(&"whine", g.world_pos, -2.0, 1.15)
		return Game.Level.CLOSE
	if ratio > 1.0 + finish_tolerance:
		finish_state = 2
		progress = maxf(progress - g.dt * 0.07, 0.0)
		if _finish_feedback_cd <= 0.0 and Game.voice:
			_finish_feedback_cd = 1.2
			Game.voice.play_at(&"yelp", g.world_pos, -1.0, randf_range(0.95, 1.1))
		return Game.Level.WRONG
	finish_state = 1
	finish_good_time = 0.0
	_add_progress(g.dt / finish_seconds)
	return Game.Level.VERY_GOOD if progress > 0.12 else Game.Level.GOOD


func _judge_crevice(region: BodyRegion, g: Gesture) -> int:
	match g.type:
		Gesture.Type.POKE:
			herring_count += 1
			region.poke_count = herring_count
			if Game.mind:
				Game.mind.herring(herring_count)
			if Game.body:
				Game.body.herring(region, herring_count)
			if stage != Stage.RHYTHM:
				progress = maxf(progress - 0.1 * herring_count, 0.0)
			if herring_count >= 3:
				region.seal()
				if Game.body:
					get_tree().create_timer(1.1).timeout.connect(func(): Game.body.shift_away(region))
			last_judgement = "poke on crevice -> !!! (%d)" % herring_count
			return Game.Level.HERRING
		Gesture.Type.HOLD:
			if Game.voice and Game.body and Game.body._ready_cd(&"hoot", 2.5):
				Game.voice.play_at(&"hoot", region.global_position, -4.0, randf_range(0.9, 1.1))
	return Game.Level.NEUTRAL


# --- Progress & stage flow -------------------------------------------------------

func _add_progress(amount: float) -> void:
	if amount <= 0.0:
		return
	progress += amount
	idle_time = 0.0
	if progress >= 1.0:
		progress = 1.0
		_advance()


func _advance() -> void:
	match stage:
		Stage.TRUST: _set_stage(Stage.DISCOVERY)
		Stage.DISCOVERY: _set_stage(Stage.RHYTHM)
		Stage.RHYTHM: _set_stage(Stage.COMBINATION)
		Stage.COMBINATION: _set_stage(Stage.FINISH)
		Stage.FINISH: _set_stage(Stage.CLIMAX)


## Debug: jump forward one stage.
func skip_stage() -> void:
	if stage == Stage.INTRO:
		begin()
	elif stage < Stage.CLIMAX:
		_advance()


## Called when irritation boils over.
func on_shifted_away() -> void:
	if stage == Stage.COMBINATION:
		combo_progress = 0.0
	else:
		progress *= 0.6


func _set_stage(s: int) -> void:
	stage = s
	progress = 0.0
	stage_time = 0.0
	idle_time = 0.0
	rhythm_streak = 0.0
	_hint_timer = 0.0
	var flap := Game.region(&"flap")
	var nod := Game.region(&"nodules")
	var body := Game.body
	var voice := Game.voice
	match s:
		Stage.TRUST:
			if flap: flap.unfold_target = 0.0
			if nod: nod.awake = 0.0
			if Game.terrain: Game.terrain.glow_target = 0.0
		Stage.DISCOVERY:
			if voice: voice.play_at(&"sigh", Game.region(&"fold").global_position, 2.0, 1.0)
			if Game.screen_fx: Game.screen_fx.exhale(1.4)
			if Game.terrain:
				Game.terrain.flush_target = 0.4
				Game.terrain.add_ripple(Game.region(&"fold").global_position, 0.8)
			if flap:
				get_tree().create_timer(1.6).timeout.connect(func():
					flap.unfold_target = 1.0
					if voice: voice.play_at(&"rustle", flap.global_position + Vector2(0, -250), 4.0, 0.6)
					if body: body.hint(flap, 0.7))
		Stage.RHYTHM:
			if body:
				body.thump(0.7)
				body.present(Game.Level.VERY_GOOD, null, flap.focus_point() if flap else Vector2.ZERO, null)
			beat_clock = 0.0
			if nod:
				var tw := create_tween()
				tw.tween_property(nod, "awake", 1.0, 2.5).set_delay(1.2)
				get_tree().create_timer(1.6).timeout.connect(func():
					if body: body.hint(nod, 0.7)
					if voice:
						for i in range(4):
							get_tree().create_timer(i * beat_interval).timeout.connect(func():
								voice.play_at(&"chime", nod.global_position, -6.0, [1.0, 1.335, 1.498, 2.0][i])))
			if Game.terrain: Game.terrain.glow_target = 0.15
		Stage.COMBINATION:
			combo_index = 0
			combo_progress = 0.0
			if voice: voice.play_at(&"groan", nod.global_position if nod else Vector2.ZERO, 2.0, 1.0)
			if Game.terrain:
				Game.terrain.glow_target = 0.45
				for i in range(4):
					Game.terrain.add_ripple(nod.global_position + Vector2(randf_range(-300, 300), randf_range(-80, 80)), 1.0)
			if body:
				body.thump(0.8)
				get_tree().create_timer(2.0).timeout.connect(func(): body.hint(current_target(), 0.8))
		Stage.FINISH:
			if voice: voice.play(&"groan", 0.0, 0.85)
			if Game.terrain:
				Game.terrain.glow_target = 0.65
				Game.terrain.flush_target = 0.7
			if body:
				body.thump(1.0)
				get_tree().create_timer(1.5).timeout.connect(func(): body.hint(Game.region(&"fur"), 0.9))
		Stage.CLIMAX:
			_climax_events.clear()
			if Game.mind: Game.mind.escalation_override = 1.0
		Stage.AFTERGLOW:
			if Game.mind: Game.mind.escalation_override = 0.04
			if Game.terrain:
				Game.terrain.glow_target = 0.3
				Game.terrain.flush_target = 0.9
			if flap: flap.unfold_target = 0.55
			if nod:
				var tw2 := create_tween()
				tw2.tween_property(nod, "awake", 0.15, 5.0)
			if Game.bill: Game.bill.sit()
		Stage.DONE:
			finished.emit()
	stage_changed.emit(s)


func _process(delta: float) -> void:
	if stage == Stage.INTRO or stage == Stage.DONE:
		return
	stage_time += delta
	beat_clock += delta
	_impatient_cd -= delta
	if stage <= Stage.FINISH:
		idle_time += delta
	match stage:
		Stage.COMBINATION:
			# The beast keeps glancing at where it wants you next.
			_hint_timer -= delta
			if _hint_timer <= 0.0 and stage_time > 2.0:
				_hint_timer = 3.0 if idle_time < hint_delay else hint_repeat * 0.7
				if Game.body:
					Game.body.hint(current_target(), 0.45 + clampf(idle_time / hint_delay, 0.0, 1.0) * 0.5)
		Stage.FINISH:
			finish_good_time += delta
			if finish_good_time > 1.2:
				finish_state = 0
				progress = maxf(progress - finish_cooldown_rate * delta, 0.0)
		Stage.CLIMAX:
			_run_climax(delta)
		Stage.AFTERGLOW:
			if stage_time > 7.5:
				_set_stage(Stage.DONE)
	if is_impatient() and stage != Stage.COMBINATION:
		_hint_timer -= delta
		if _hint_timer <= 0.0:
			_hint_timer = hint_repeat
			var k := clampf((idle_time - hint_delay) / 25.0, 0.0, 1.0)
			if Game.body:
				Game.body.hint(current_target(), 0.5 + k * 0.5)


func _once(key: String, at: float) -> bool:
	if stage_time >= at and not _climax_events.has(key):
		_climax_events[key] = true
		return true
	return false


func _run_climax(_delta: float) -> void:
	var body := Game.body
	var voice := Game.voice
	if _once("roar", 0.0) and voice:
		voice.play(&"roar", 2.0, 1.0)
	if stage_time < 4.6 and body and randf() < 0.18:
		if Game.terrain:
			var cx := Game.camera_x()
			Game.terrain.add_ripple(Vector2(cx + randf_range(-900, 900), randf_range(350, 950)), 1.2)
	if _once("t1", 0.8) and body: body.thump(1.1)
	if _once("t2", 1.5) and body: body.thump(1.2)
	if _once("t3", 2.1) and body: body.thump(1.3)
	if _once("t4", 2.6) and body: body.thump(1.4)
	if _once("t5", 3.0) and body: body.thump(1.5)
	if _once("t6", 3.35) and body: body.thump(1.6)
	if _once("t7", 3.65) and body: body.thump(1.7)
	if _once("t8", 3.9) and body: body.thump(1.8)
	if _once("t9", 4.1) and body: body.thump(1.9)
	if _once("t10", 4.3) and body: body.thump(2.0)
	if _once("release", 4.6):
		if voice:
			voice.play(&"bellow", 6.0, 0.7)
			voice.play(&"exhale", 4.0, 0.8)
		if Game.camera: Game.camera.shake(1.0)
		if Game.screen_fx:
			Game.screen_fx.flash(0.75)
			Game.screen_fx.exhale(3.0)
			Game.screen_fx.dust_burst(1.5)
		if body:
			body.impulse(Vector2(0, -260), 0.02)
		if Game.decor: Game.decor.bounce(900.0)
		if Game.terrain:
			Game.terrain.glow_target = 1.0
			for i in range(6):
				Game.terrain.add_ripple(Vector2(Game.camera_x() + randf_range(-800, 800), randf_range(400, 900)), 1.6)
		for r in Game.regions.values():
			r.body_jolt(2.0)
		var crev := Game.region(&"crevice")
		if crev and not crev.sealed:
			crev.flare = 1.0
	if _once("afterglow", 5.6):
		if voice:
			voice.play(&"sigh", 0.0, 0.7)
			voice.play(&"purr", -4.0, 0.8)
		_set_stage(Stage.AFTERGLOW)
