extends Node
## Headless gameplay test. Unit-checks the GestureRecognizer, then plays the
## whole game with simulated mouse input: red herring, all five stages, the
## climax and the ending. Exits with code 0 on success, 1 on failure.
##
##   godot --headless --path . --fixed-fps 60 res://tests/playthrough_test.tscn

const DT := 1.0 / 60.0

var main: Node
var gr: GestureRecognizer
var sim_t := 100.0
var failures: Array[String] = []
var log_lines: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _recognizer_tests()
	await _playthrough()
	for l in log_lines:
		print(l)
	print("process time (headless, no rendering): avg %.2f ms, max %.2f ms over %d frames" % [perf_sum / maxi(perf_n, 1), perf_max, perf_n])
	for st in perf_stage:
		print("   stage %-14s %.2f ms" % [TendingSequence.STAGE_NAMES[st], perf_stage[st][0] / perf_stage[st][1]])
	if failures.is_empty():
		print("\nALL TESTS PASSED")
		get_tree().quit(0)
	else:
		print("\nFAILURES:")
		for f in failures:
			print("  - ", f)
		get_tree().quit(1)


func check(cond: bool, what: String) -> void:
	log_lines.append(("  ok   " if cond else "  FAIL ") + what)
	if not cond:
		failures.append(what)


# --- Recognizer unit tests -----------------------------------------------------------

func _recognizer_tests() -> void:
	log_lines.append("GestureRecognizer")
	var r := GestureRecognizer.new()
	r.external_clock = true
	add_child(r)
	var seen: Array = []
	r.gesture_detected.connect(func(g): seen.append(g.type))
	var t := 0.0
	var c := Vector2(800, 500)

	# Poke.
	seen.clear()
	r.feed_press(c, t)
	t += 0.08
	r.update(t)
	r.feed_release(c, t)
	check(seen.has(Gesture.Type.POKE), "quick click is a POKE")

	# Hold.
	seen.clear()
	t += 2.0
	r.feed_press(c, t)
	for i in range(60):
		t += DT
		r.feed_motion(c + Vector2(randf_range(-2, 2), randf_range(-2, 2)), t)
		r.update(t)
	r.feed_release(c, t)
	check(_dominant(seen) == Gesture.Type.HOLD, "stationary press is a HOLD (%s)" % _names(seen))

	# Stroke: straight, smooth, 320 px/s.
	seen.clear()
	t += 2.0
	r.feed_press(c, t)
	for i in range(90):
		t += DT
		r.feed_motion(c + Vector2(i * 320.0 * DT, i * 0.5), t)
		r.update(t)
	r.feed_release(c, t)
	check(_dominant(seen) == Gesture.Type.STROKE, "straight drag is a STROKE (%s)" % _names(seen))

	# Rub: back and forth 130 px at 1.4 Hz.
	seen.clear()
	t += 2.0
	r.feed_press(c, t)
	for i in range(150):
		t += DT
		r.feed_motion(c + Vector2(sin(i * DT * TAU * 1.4) * 65.0, cos(i * DT * TAU * 1.4) * 12.0), t)
		r.update(t)
	r.feed_release(c, t)
	check(_dominant(seen) == Gesture.Type.RUB, "slow back-and-forth is a RUB (%s)" % _names(seen))

	# Circular rub.
	seen.clear()
	t += 2.0
	r.feed_press(c, t)
	for i in range(150):
		t += DT
		var a := i * DT * TAU * 1.2
		r.feed_motion(c + Vector2(cos(a), sin(a)) * 60.0, t)
		r.update(t)
	r.feed_release(c, t)
	check(_dominant(seen) == Gesture.Type.RUB, "circles are a RUB (%s)" % _names(seen))

	# Scratch: small, fast, 7 Hz.
	seen.clear()
	t += 2.0
	r.feed_press(c, t)
	for i in range(120):
		t += DT
		r.feed_motion(c + Vector2(sin(i * DT * TAU * 7.0) * 18.0, sin(i * DT * TAU * 3.0) * 6.0), t)
		r.update(t)
	r.feed_release(c, t)
	check(_dominant(seen) == Gesture.Type.SCRATCH, "small fast jitter is a SCRATCH (%s)" % _names(seen))

	# Rhythmic tapping.
	seen.clear()
	t += 3.0
	for k in range(5):
		r.feed_press(c, t)
		t += 0.06
		r.update(t)
		r.feed_release(c, t)
		t += 0.54
	check(seen.has(Gesture.Type.RHYTHM), "even taps become RHYTHMIC TAP")
	seen.clear()
	t += 3.0
	for k in [0.0, 0.2, 1.1, 1.3]:
		r.feed_press(c, t + k)
		r.feed_release(c, t + k + 0.05)
	check(not seen.has(Gesture.Type.RHYTHM), "uneven taps are not a rhythm")
	r.queue_free()
	await get_tree().process_frame


func _dominant(types: Array) -> int:
	var counts := {}
	for ty in types:
		counts[ty] = counts.get(ty, 0) + 1
	var best := -1
	var bc := 0
	for k in counts:
		if counts[k] > bc:
			bc = counts[k]
			best = k
	return best


func _names(types: Array) -> String:
	var counts := {}
	for ty in types:
		counts[Gesture.type_name(ty)] = counts.get(Gesture.type_name(ty), 0) + 1
	return str(counts)


# --- Full playthrough ----------------------------------------------------------------

var perf_sum := 0.0
var perf_max := 0.0
var perf_n := 0
var perf_stage := {}


func frame() -> void:
	await get_tree().process_frame
	var pt := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
	perf_sum += pt
	perf_max = maxf(perf_max, pt)
	perf_n += 1
	if Game.sequence:
		var st: int = Game.sequence.stage
		var e: Array = perf_stage.get(st, [0.0, 0])
		e[0] += pt
		e[1] += 1
		perf_stage[st] = e
	sim_t += DT
	gr.update(sim_t)


func wait(sec: float) -> void:
	for i in range(int(sec * 60.0)):
		await frame()


func go_to(x: float) -> void:
	Game.camera.target_x = x
	Game.camera.position.x = x
	await wait(0.4)


func screen_of(world: Vector2) -> Vector2:
	return Game.world_to_screen(world)


func poke_at(screen: Vector2) -> void:
	gr.feed_motion(screen, sim_t)
	gr.feed_press(screen, sim_t)
	await frame()
	await frame()
	gr.feed_release(screen, sim_t)
	await frame()


## Hold the button and move along fn(k) for `dur` seconds, k in 0..1.
func drag(fn: Callable, dur: float) -> void:
	var n := int(dur * 60.0)
	var p0: Vector2 = fn.call(0.0)
	gr.feed_motion(p0, sim_t)
	gr.feed_press(p0, sim_t)
	for i in range(n):
		gr.feed_motion(fn.call(float(i + 1) / n), sim_t)
		await frame()
	gr.feed_release(fn.call(1.0), sim_t)
	await frame()


func scratch_at(screen: Vector2, dur: float, speed: float = 500.0, hz: float = 6.0) -> void:
	var amp := speed / (4.0 * hz)
	await drag(func(k): return screen + Vector2(sin(k * dur * TAU * hz) * amp, sin(k * dur * TAU * hz * 0.5) * 5.0), dur)


func rub_at(screen: Vector2, dur: float) -> void:
	await drag(func(k): return screen + Vector2(sin(k * dur * TAU * 1.3) * 70.0, cos(k * dur * TAU * 1.3) * 18.0), dur)


func stroke(from: Vector2, to: Vector2, dur: float) -> void:
	await drag(func(k): return from.lerp(to, k), dur)


func _stage() -> int:
	return Game.sequence.stage


func _playthrough() -> void:
	log_lines.append("Playthrough")
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await get_tree().process_frame
	gr = Game.gestures
	gr.external_clock = true
	main.cards.hide_cards()
	main._start()
	Game.camera.input_enabled = false  # no real mouse here; don't edge-pan
	await wait(0.5)
	var seq: TendingSequence = Game.sequence
	var mind: BeastMind = Game.mind
	check(_stage() == TendingSequence.Stage.TRUST, "game starts in stage 1 (trust)")

	# --- Red herring: the crevice.
	var crev: BodyRegion = Game.region(&"crevice")
	await go_to(crev.global_position.x)
	for i in range(3):
		await poke_at(screen_of(crev.global_position))
		await wait(0.8)
	check(seq.herring_count == 3, "three crevice pokes registered")
	await wait(1.5)
	check(not crev.accessible, "third poke: beast moves the crevice out of reach")
	check(mind.irritation > 0.2 or mind.mood == BeastMind.Mood.IRRITATED, "crevice pokes irritate (irritation %.2f)" % mind.irritation)
	await poke_at(screen_of(crev.global_position))
	check(seq.herring_count == 3, "sealed crevice no longer reacts")
	await wait(6.0)  # let it calm down

	# --- Wrong touch is punished: poke the fold during trust.
	var fold: BodyRegion = Game.region(&"fold")
	await go_to(fold.global_position.x)
	var before := mind.irritation
	await poke_at(screen_of(fold.global_position))
	check(mind.irritation > before, "poking the wary fold irritates it")

	# --- Stage 1: slow strokes along the fold.
	var t0 := sim_t
	while _stage() == TendingSequence.Stage.TRUST and sim_t - t0 < 40.0:
		var c := screen_of(fold.global_position + Vector2(0, -20))
		await stroke(c + Vector2(-280, 0), c + Vector2(280, 8), 1.8)
		await wait(0.15)
	check(_stage() == TendingSequence.Stage.DISCOVERY, "slow strokes on the Soft Fold complete stage 1 (%.1fs)" % (sim_t - t0))

	# A fast stroke would have been wrong.
	# --- Stage 2: scratch under the unfolded flap.
	var flap: BodyRegion = Game.region(&"flap")
	await go_to(flap.global_position.x)
	await wait(3.5)
	check(flap.revealed() > 0.6, "the Great Flap unfolds (revealed %.2f)" % flap.revealed())
	before = mind.irritation
	await poke_at(screen_of(flap.focus_point() + Vector2(0, -200)))
	t0 = sim_t
	while _stage() == TendingSequence.Stage.DISCOVERY and sim_t - t0 < 30.0:
		await scratch_at(screen_of(flap.focus_point()), 2.0, 520.0)
	check(_stage() == TendingSequence.Stage.RHYTHM, "scratching the flap underside completes stage 2 (%.1fs)" % (sim_t - t0))

	# --- Stage 3: tap the nodules in time with their pulse.
	var nod: BodyRegion = Game.region(&"nodules")
	await go_to(nod.global_position.x)
	await wait(2.5)
	# Off-beat tapping should not progress much.
	var p_before := seq.progress
	for i in range(4):
		await poke_at(screen_of(nod.global_position))
		await wait(0.37)
	check(seq.progress <= p_before + 0.26, "off-beat taps barely help (%.2f -> %.2f)" % [p_before, seq.progress])
	t0 = sim_t
	var taps := 0
	while _stage() == TendingSequence.Stage.RHYTHM and sim_t - t0 < 30.0:
		var ph := fposmod(seq.beat_clock, seq.beat_interval)
		if ph < DT * 1.5:
			await poke_at(screen_of(nod.global_position + Vector2(randf_range(-80, 80), 0)))
			taps += 1
		else:
			await frame()
	check(_stage() == TendingSequence.Stage.COMBINATION, "on-beat taps complete stage 3 (%d taps, %.1fs)" % [taps, sim_t - t0])

	# --- Stage 4: follow the beast's attention: fur, flap, whiskers, twice.
	t0 = sim_t
	var steps := 0
	while _stage() == TendingSequence.Stage.COMBINATION and sim_t - t0 < 90.0:
		var target: BodyRegion = seq.current_target()
		await go_to(target.global_position.x)
		match target.region_id:
			&"fur":
				await scratch_at(screen_of(target.global_position), 2.0, 520.0)
			&"flap":
				await rub_at(screen_of(target.focus_point()), 2.0)
			&"whiskers":
				var c := screen_of(target.global_position + Vector2(0, -200))
				await stroke(c + Vector2(-420, 0), c + Vector2(420, 0), 1.2)
		steps += 1
		if steps <= 12:
			log_lines.append("    combo attempt %d on %s -> index %d progress %.2f (%s)" % [steps, target.region_id, seq.combo_index, seq.combo_progress, seq.last_judgement])
	check(_stage() == TendingSequence.Stage.FINISH, "alternating fur/flap/whiskers completes stage 4 (%d attempts, %.1fs)" % [steps, sim_t - t0])

	# --- Stage 5: keep scratching the fur at the pace it wants.
	var fur: BodyRegion = Game.region(&"fur")
	await go_to(fur.global_position.x)
	# Far too fast first: should not progress.
	p_before = seq.progress
	await scratch_at(screen_of(fur.global_position), 1.5, 1600.0, 9.0)
	check(seq.progress <= p_before + 0.01, "frantic scratching does not help the finish")
	check(seq.progress < 0.05, "stage 5 starts from scratch (%.2f)" % seq.progress)
	t0 = sim_t
	while _stage() == TendingSequence.Stage.FINISH and sim_t - t0 < 60.0:
		var want := lerpf(seq.finish_speed_start, seq.finish_speed_end, seq.progress)
		await scratch_at(screen_of(fur.global_position), 1.5, want, 6.0)
	check(_stage() >= TendingSequence.Stage.CLIMAX and sim_t - t0 > 8.0, "sustained scratching at the right pace completes stage 5 (%.1fs)" % (sim_t - t0))
	check(mind.escalation > 0.8, "escalation is near maximum (%.2f)" % mind.escalation)

	# --- Climax and ending.
	var ended := [false]
	seq.finished.connect(func(): ended[0] = true)
	t0 = sim_t
	while not ended[0] and sim_t - t0 < 25.0:
		await frame()
	check(ended[0], "climax, afterglow and ending play out (%.1fs)" % (sim_t - t0))
	check(mind.mood == BeastMind.Mood.SPENT, "the beast is spent")
	check(main.cards.mode == "end", "ending card is shown")
