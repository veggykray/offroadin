class_name HumanZooGame
extends Node
## Orchestrates the Human Zoo: owns the data, state and controllers, and talks
## to whatever world nodes have been registered (enclosures, stations, the
## central machine, gallery, pipes) and to the UI.
##
## Integration contract (see README.md):
##   * Register world nodes with register_enclosure/station/machine/... then
##     call start().
##   * Assign `player` (any Node2D). The game reads its global_position to
##     decide which microphone/machine is in reach, and tells it to lock/unlock
##     via player_lock_changed (and set_locked() if the node has it).
##   * Listen to focus_requested / focus_released to move your camera.
##   * Listen to minigame_completed to leave the scene.

signal conversation_started(character_id: String)
signal conversation_ended(character_id: String)
signal topic_learned(topic_id: String)
signal stage_completed(stage_number: int, stage_name: String)
signal machine_attempted(solved: bool, correct: int)
signal puzzle_solved
signal minigame_completed
signal player_lock_changed(locked: bool)
signal focus_requested(world_position: Vector2, zoom: float)
signal focus_released
## Machine controls opened/closed. operator_position is a good spot for the
## player to stand so they don't hide the dials (beside the lever).
signal machine_mode_changed(active: bool, operator_position: Vector2)

## Path to the content file. Empty = data/human_zoo_content.json next to this module.
@export_file("*.json") var content_path: String = ""
@export var interact_radius := 150.0
@export var machine_interact_radius := 430.0
@export var idle_barks := true
@export var debug_keys := true

var db := HumanZooDatabase.new()
var state := HumanZooState.new()
var conversation: HumanZooConversation
var progress: HumanZooProgress
var puzzle: HumanZooMachinePuzzle
var guidance: HumanZooGuidanceController
var sfx: HumanZooSfx
var ui: HumanZooUI

var player: Node2D
var enclosures: Dictionary = {}
var stations: Dictionary = {}
var machine: HumanZooCentralMachine
var gallery: HumanZooGallery
var pipes: HumanZooPipes

var mode := "explore"   # explore | dialogue | machine | tuning | cutscene | finale
var _focus := ""             # character id of the station in reach, "@machine", or ""
var _cooldown := 0.0
var _bell_timer := 0.0
var _bell_count := 0
var _pending_reveals: Array = []
var _queued_thoughts: Array = []
var _attention_until: Dictionary = {}
var _fired_observations: Dictionary = {}
var _bark_timer := 8.0
var _lever_thought := 0
var _machine_visited := false
var _debug_overlay := false
var _started := false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	HumanZooInput.ensure_actions()
	var path := content_path
	if path == "":
		path = (get_script() as Script).resource_path.get_base_dir().path_join("../../data/human_zoo_content.json").simplify_path()
	db.load_file(path)
	for problem in db.validate():
		push_warning("HumanZoo content: " + problem)
	conversation = HumanZooConversation.new(db, state)
	progress = HumanZooProgress.new(db, state)
	puzzle = HumanZooMachinePuzzle.new(db, state)
	guidance = HumanZooGuidanceController.new()
	guidance.name = "Guidance"
	add_child(guidance)
	guidance.setup(db, state, conversation)
	guidance.character_notice.connect(_on_guidance_notice)
	guidance.character_attention.connect(_on_guidance_attention)
	guidance.bill_thought.connect(_on_guidance_thought)
	guidance.nudge_available.connect(_on_nudge_available)
	sfx = HumanZooSfx.new()
	sfx.name = "Sfx"
	add_child(sfx)
	for t in db.initial_topics:
		state.learn_topic(t)
	for c in get_children():
		if c is HumanZooUI:
			ui = c
	if ui == null:
		ui = HumanZooUI.new()
		ui.name = "UI"
		add_child(ui)


# ================================================================ registration

func register_enclosure(e: HumanZooEnclosure) -> void:
	enclosures[e.character_id] = e
	var c := db.character(e.character_id)
	if c:
		e.set_idle_behaviours(c.idle_behaviours)
		if e.plaque_text == "":
			e.plaque_text = c.plaque_name


func register_station(s: HumanZooCommStation) -> void:
	stations[s.character_id] = s


func register_machine(m: HumanZooCentralMachine) -> void:
	machine = m
	m.beat.connect(_on_machine_beat)


func register_gallery(g: HumanZooGallery) -> void:
	gallery = g


func register_pipes(p: HumanZooPipes) -> void:
	pipes = p


func start() -> void:
	ui.bill = player
	ui.board.setup(db, state, progress)
	ui.blip.connect(func(p): sfx.play("blip", p, -10.0))
	ui.tuning.closeness_changed.connect(_on_tuning_closeness)
	_bell_timer = float(db.world.get("bell_interval", 15.0)) * 0.5
	_apply_visual_state(false)
	_started = true
	await get_tree().create_timer(1.2).timeout
	ui.think(String(db.bill.get("intro_thought", "")), 5.0)


# ====================================================================== update

func _process(delta: float) -> void:
	if not _started:
		return
	_cooldown = maxf(_cooldown - delta, 0.0)
	var px := player.global_position.x if player else 0.0
	for e in enclosures.values():
		e.look_target_x = px
	_update_focus()
	_update_lamps()
	_update_bells(delta)
	if mode == "explore":
		guidance.suspended = false
		if not _queued_thoughts.is_empty():
			ui.think(_queued_thoughts.pop_front(), 5.5)
		_update_idle_barks(delta)
	if _debug_overlay:
		var d := guidance.debug_summary()
		var lines := PackedStringArray()
		for k in d.keys():
			lines.append("%s: %s" % [k, str(d[k])])
		lines.append("mode: " + mode)
		ui.set_debug("\n".join(lines))


func _update_focus() -> void:
	var new_focus := ""
	if mode == "explore" and player:
		var px := player.global_position.x
		var best := interact_radius
		for cid in stations.keys():
			var d := absf(stations[cid].global_position.x - px)
			if d < best:
				best = d
				new_focus = cid
		if new_focus == "" and machine and absf(machine.global_position.x - px) < machine_interact_radius:
			new_focus = "@machine"
	if new_focus != _focus:
		if stations.has(_focus):
			stations[_focus].set_focused(false)
		_focus = new_focus
		if stations.has(_focus):
			stations[_focus].set_focused(true)
	if mode != "explore" or _focus == "":
		ui.show_prompt("")
	elif _focus == "@machine":
		ui.show_prompt("E   Approach the machine")
	else:
		ui.show_prompt("E   " + _prompt_for(_focus))


func _prompt_for(cid: String) -> String:
	var c := db.character(cid)
	if c == null:
		return "Speak"
	if c.tuned_flag != "" and not state.has_fact(c.tuned_flag):
		if state.has_fact("voice_awake"):
			return "Tune the empty microphone"
		return "Listen to the empty microphone"
	return "Speak to " + _name(cid)


func _name(cid: String) -> String:
	var c := db.character(cid)
	if c == null:
		return cid.to_upper()
	if state.has_fact("met_" + cid) or c.plaque_name == "":
		return c.display_name
	return c.plaque_name


func _update_lamps() -> void:
	var now := Time.get_ticks_msec() / 1000.0
	for cid in stations.keys():
		var s: HumanZooCommStation = stations[cid]
		var lamp := "off"
		var c := db.character(cid)
		if c and c.tuned_flag != "" and not state.has_fact(c.tuned_flag):
			lamp = "static" if state.has_fact("voice_awake") else "off"
		else:
			for t in state.topic_order:
				var td := db.topic(t)
				if td and td.kind == "message" and td.to_character == cid and not state.consumed.has(t):
					lamp = "message"
					break
		if float(_attention_until.get(cid, 0.0)) > now:
			lamp = "attention"
		s.set_lamp(lamp)


func _update_bells(delta: float) -> void:
	if mode == "finale":
		return
	_bell_timer -= delta
	if _bell_timer > 0.0:
		return
	_bell_timer = float(db.world.get("bell_interval", 15.0))
	_bell_count += 1
	var third := _bell_count % 3 == 0
	sfx.play("bell_low" if third else "bell", 1.0, -4.0)
	if gallery:
		gallery.ring_bell(third)
	if third:
		_third_bell_sequence()


func _third_bell_sequence() -> void:
	var cfg: Dictionary = db.world.get("third_bell", {})
	var king: HumanZooEnclosure = enclosures.get(String(cfg.get("target", "king")))
	if king == null:
		return
	var lights := float(cfg.get("lights_out", 4.5))
	king.lights_out(lights)
	_check_observations("third_bell")
	var tree := get_tree()
	tree.create_timer(float(cfg.get("bird_delay", 0.6))).timeout.connect(func():
		if gallery:
			gallery.fly_bird(king.global_position - gallery.global_position + Vector2(king.width * 0.18, -king.height - 4), lights - 0.6))
	tree.create_timer(float(cfg.get("bird_delay", 0.6)) + 1.6).timeout.connect(func(): king.bird_visit(lights - 2.2))
	tree.create_timer(float(cfg.get("moon_delay", 3.2))).timeout.connect(func():
		if gallery:
			gallery.light_moon(2.6))
	tree.create_timer(float(cfg.get("hand_delay", 5.4))).timeout.connect(func():
		if gallery:
			gallery.lower_hand(2.4))


func _check_observations(event: String) -> void:
	if player == null:
		return
	for o in db.observations:
		if String(o.get("event", "")) != event:
			continue
		var oid := String(o.get("id", ""))
		if bool(o.get("once", false)) and _fired_observations.has(oid):
			continue
		if not HumanZooConditions.check(o.get("if"), state):
			continue
		var near: HumanZooEnclosure = enclosures.get(String(o.get("near", "")))
		if near and absf(near.global_position.x - player.global_position.x) > float(o.get("radius", 600.0)):
			continue
		_fired_observations[oid] = true
		if mode == "explore":
			ui.think(String(o.get("thought", "")), 5.0)
		else:
			_queued_thoughts.append(String(o.get("thought", "")))
		_after_effects("", o.get("do", {}))
		if mode == "explore":
			_play_reveals()


func _update_idle_barks(delta: float) -> void:
	if not idle_barks or player == null:
		return
	_bark_timer -= delta
	if _bark_timer > 0.0:
		return
	_bark_timer = _rng.randf_range(10.0, 18.0)
	var near: Array = []
	for cid in enclosures.keys():
		if absf(enclosures[cid].global_position.x - player.global_position.x) < 800.0:
			near.append(cid)
	if near.is_empty():
		return
	var cid: String = near[_rng.randi() % near.size()]
	var c := db.character(cid)
	var pool: Array = c.barks.get("idle", []) if c else []
	if not pool.is_empty():
		enclosures[cid].bark(String(pool[_rng.randi() % pool.size()]))


# ======================================================================= input

func _unhandled_input(event: InputEvent) -> void:
	if not _started:
		return
	if debug_keys and event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_F1:
				_debug_overlay = not _debug_overlay
				if not _debug_overlay:
					ui.set_debug("")
			KEY_F2:
				if mode == "explore":
					debug_skip_stage()
			KEY_F3:
				guidance.time_scale = 12.0 if guidance.time_scale == 1.0 else 1.0
				ui.think("(debug) guidance time x%d" % int(guidance.time_scale), 2.0)
			KEY_F4:
				sfx.muted = not sfx.muted
	match mode:
		"explore":
			if _cooldown > 0.0:
				return
			if event.is_action_pressed("hz_interact"):
				get_viewport().set_input_as_handled()
				if _focus == "@machine":
					enter_machine()
				elif _focus != "":
					talk_to(_focus)
			elif event.is_action_pressed("hz_board"):
				get_viewport().set_input_as_handled()
				ui.toggle_board()
			elif event.is_action_pressed("hz_nudge") and guidance.is_nudge_offered():
				get_viewport().set_input_as_handled()
				ui.think(guidance.request_nudge(), 7.0, true)
		"machine":
			_machine_input(event)


# ================================================================ conversation

func talk_to(cid: String) -> void:
	if mode != "explore":
		return
	var c := db.character(cid)
	if c == null:
		return
	if not conversation.is_character_available(cid):
		if c.awake_when != null and HumanZooConditions.check(c.awake_when, state) and c.tuned_flag != "":
			_open_tuning(cid)
		else:
			_static_exchange(cid)
		return
	_set_mode("dialogue")
	var station: HumanZooCommStation = stations.get(cid)
	if station:
		station.set_active(true)
		station.pulse()
	conversation_started.emit(cid)
	var stage_before := state.stage
	if not state.has_fact("met_" + cid):
		var g := conversation.greeting(cid)
		await _play(cid, g["lines"])
		_after_effects(cid, conversation.commit(g))
	while state.stage == stage_before:
		var opts := conversation.get_options(cid)
		var topic: String = await ui.choose(opts)
		if topic == HumanZooConversation.LEAVE:
			break
		var already := state.times_asked(cid, topic) > 0
		var res := conversation.resolve(cid, topic)
		var td := db.topic(topic)
		await _play(cid, res["lines"], {"topic": td.noun if td else "that"})
		_after_effects(cid, conversation.commit(res))
		var kind: String = res["kind"]
		if kind == "dead_end" and already:
			kind = "repeat"
		guidance.notify_conversation(kind)
	ui.close_dialogue()
	if station:
		station.set_active(false)
	_set_mode("explore")
	conversation_ended.emit(cid)
	_play_reveals()


func _static_exchange(cid: String) -> void:
	var c := db.character(cid)
	_set_mode("dialogue")
	var pool: Array = c.static_lines if not c.static_lines.is_empty() else [HumanZooLines.normalize([{"do": "(Static.)"}])]
	sfx.set_loop("static", 0.25)
	var lines: Array = pool[state.next_rotation(cid + "|static", pool.size())]
	await _play(cid, lines)
	sfx.set_loop("static", 0.0)
	ui.close_dialogue()
	guidance.notify_conversation("dead_end")
	_set_mode("explore")


## Plays a list of normalised lines. ctx fills {placeholders}.
func _play(cid: String, lines: Array, ctx := {}) -> void:
	for line in lines:
		if String(line.get("action", "")) != "":
			_perform_action(cid, line["action"], line.get("args", []))
		var text := HumanZooLines.fill(String(line.get("text", "")), ctx)
		var who := String(line.get("who", "self"))
		if who == "self":
			who = cid
		if text == "":
			if float(line.get("pause", 0.0)) > 0.0:
				var speaker := _name(who) if db.character(who) else ""
				await ui.say(speaker, "", "pause", 1.0, float(line["pause"]))
			continue
		match who:
			"bill":
				await ui.say("BILL", text, "bill", 1.25)
			"narrator", "":
				await ui.say("", text, "narrator")
			"thought":
				ui.think(text, 4.0)
			_:
				var c := db.character(who)
				var e: HumanZooEnclosure = enclosures.get(who)
				if e:
					e.set_talking(true)
				var style := "character"
				if ctx.get("loud", "") == who:
					style = "loud"
					ctx.erase("loud")
				await ui.say(_name(who), text, style, c.voice_pitch if c else 1.0)
				if e:
					e.set_talking(false)


func _perform_action(cid: String, action: String, args: Array) -> void:
	match action:
		"shake_selector":
			if machine and not args.is_empty():
				machine.shake_selector_id(String(args[0]))
				sfx.play("ratchet")
		_:
			var e: HumanZooEnclosure = enclosures.get(cid)
			if e:
				e.perform_action(action, args)


## Applies effects, notifies guidance, checks stages. Returns facts gained.
func _after_effects(cid: String, effects: Dictionary) -> Array:
	var gained := progress.apply_effects(effects)
	if not gained.is_empty():
		guidance.notify_discovery(gained, cid)
		for id in gained:
			if db.topic(id) != null:
				topic_learned.emit(id)
			if String(id).begins_with("desire_"):
				_light_desire(String(id).trim_prefix("desire_"), true)
	_check_voice_awake()
	var done := progress.check_stages()
	for n in done:
		_pending_reveals.append(n)
		stage_completed.emit(n, String(db.stages[n - 1].get("name", "")))
	return gained


func _check_voice_awake() -> void:
	if state.has_fact("voice_awake"):
		return
	for cid in db.character_order:
		var c := db.character(cid)
		if c.awake_when != null and c.tuned_flag != "" and HumanZooConditions.check(c.awake_when, state):
			state.add_fact("voice_awake")
			_queued_thoughts.append(String(db.bill.get("empty_awake_thought", "")))
			var e: HumanZooEnclosure = enclosures.get(cid)
			if e:
				e.play_behaviour("static_flicker", 3.0)
			sfx.play("hiss", 1.6, -8.0)


func _light_desire(cid: String, animate: bool) -> void:
	if pipes:
		pipes.set_glow(cid, 1.0)
		if animate:
			pipes.flash(cid)
	if machine:
		machine.selector_glow[cid] = 1.0
	if animate:
		sfx.play("lamp", 0.8)


# ===================================================================== reveals

## The CLUNK moments: the camera visits the machine and shows what changed.
func _play_reveals() -> void:
	if _pending_reveals.is_empty() or mode != "explore":
		return
	_set_mode("cutscene")
	while not _pending_reveals.is_empty():
		var n: int = _pending_reveals.pop_front()
		var stage: Dictionary = db.stages[n - 1]
		if machine:
			focus_requested.emit(machine.global_position + Vector2(0, -360), 0.82)
		await get_tree().create_timer(0.9).timeout
		_apply_stage_visuals(stage, true)
		await get_tree().create_timer(2.2).timeout
		ui.think(String(stage.get("bill_thought", "I'm getting somewhere.")), 4.5)
		await get_tree().create_timer(1.6).timeout
	focus_released.emit()
	await get_tree().create_timer(0.4).timeout
	_set_mode("explore")


func _apply_stage_visuals(stage: Dictionary, animate: bool) -> void:
	var m: Dictionary = stage.get("machine", {})
	if machine:
		machine.set_level(int(m.get("level", 0)), animate)
		machine.activate_symbols(m.get("symbols", []), animate)
		if int(m.get("level", 0)) >= 5:
			machine.set_lever_unlocked(true)
	if pipes:
		var pipe_map: Dictionary = m.get("pipes", {})
		for id in pipe_map.keys():
			pipes.set_glow(id, float(pipe_map[id]))
			if animate:
				pipes.flash(id)
	if animate and int(m.get("level", 0)) >= 4:
		sfx.set_loop("hum", 0.18)


## Rebuild every visual from state (start-up, or after loading a save).
func _apply_visual_state(animate: bool) -> void:
	if machine:
		machine.set_level(0, false)
	for i in state.stage:
		_apply_stage_visuals(db.stages[i], animate)
	if state.stage >= 4:
		sfx.set_loop("hum", 0.18)
	for cid in puzzle.selector_ids:
		if state.has_fact("desire_" + cid):
			_light_desire(cid, false)
	if machine:
		for i in puzzle.selector_ids.size():
			machine.set_selector(i, puzzle.symbol_for(puzzle.selector_ids[i]), false)


# ===================================================================== tuning

func _open_tuning(cid: String) -> void:
	_set_mode("tuning")
	var station: HumanZooCommStation = stations.get(cid)
	var cfg: Dictionary = db.world.get("tuning", {})
	ui.tuning.open(cfg, station.tuning_value if station else 0.2)
	sfx.set_loop("static", 0.6)
	var result: Array = []
	var on_tuned := func(): result.append("tuned")
	var on_cancel := func(): result.append("cancelled")
	ui.tuning.tuned.connect(on_tuned, CONNECT_ONE_SHOT)
	ui.tuning.cancelled.connect(on_cancel, CONNECT_ONE_SHOT)
	while result.is_empty():
		if station:
			station.tuning_value = ui.tuning.value
		await get_tree().process_frame
	if ui.tuning.tuned.is_connected(on_tuned):
		ui.tuning.tuned.disconnect(on_tuned)
	if ui.tuning.cancelled.is_connected(on_cancel):
		ui.tuning.cancelled.disconnect(on_cancel)
	ui.tuning.close()
	sfx.set_loop("static", 0.0)
	var e: HumanZooEnclosure = enclosures.get(cid)
	if result[0] == "tuned":
		var c := db.character(cid)
		sfx.play("sting")
		_after_effects(cid, {"set": [c.tuned_flag]})
		if e:
			e.presence = 0.35
		await get_tree().create_timer(0.8).timeout
		_set_mode("explore")
		talk_to(cid)
	else:
		if e:
			e.presence = 0.0
		ui.think(String(db.bill.get("dial_hint", "")), 3.0)
		_set_mode("explore")


func _on_tuning_closeness(cl: float) -> void:
	sfx.set_loop("static", 0.15 + 0.5 * (1.0 - cl), 1.0 - cl * 0.25)
	var e: HumanZooEnclosure = enclosures.get("empty")
	if e:
		e.presence = cl * 0.55


# ==================================================================== machine

func enter_machine() -> void:
	if machine == null or mode != "explore":
		return
	_set_mode("machine")
	machine.machine_mode = true
	machine.selected = clampi(machine.selected, 0, puzzle.selector_ids.size())
	focus_requested.emit(machine.global_position + Vector2(0, -330), 0.85)
	machine_mode_changed.emit(true, machine.global_position + machine.operator_offset())
	ui.show_machine_help(true, machine.lever_unlocked)
	if not _machine_visited:
		_machine_visited = true
		ui.think(String(db.bill.get("selectors_hint", "")), 4.5)


func exit_machine() -> void:
	machine.machine_mode = false
	ui.show_machine_help(false)
	focus_released.emit()
	machine_mode_changed.emit(false, machine.global_position + machine.operator_offset())
	_set_mode("explore")


func _machine_input(event: InputEvent) -> void:
	var n := puzzle.selector_ids.size()
	if event.is_action_pressed("hz_cancel") or event.is_action_pressed("hz_board"):
		get_viewport().set_input_as_handled()
		exit_machine()
	elif event.is_action_pressed("hz_left"):
		get_viewport().set_input_as_handled()
		machine.selected = wrapi(machine.selected - 1, 0, n + 1)
		sfx.play("lamp", 1.4, -8.0)
	elif event.is_action_pressed("hz_right"):
		get_viewport().set_input_as_handled()
		machine.selected = wrapi(machine.selected + 1, 0, n + 1)
		sfx.play("lamp", 1.4, -8.0)
	elif event.is_action_pressed("hz_up") or event.is_action_pressed("hz_down") or event.is_action_pressed("hz_interact"):
		get_viewport().set_input_as_handled()
		if machine.selected < n:
			var dir := -1 if event.is_action_pressed("hz_down") else 1
			var sym := puzzle.rotate(machine.selected, dir)
			machine.set_selector(machine.selected, sym)
			sfx.play("ratchet")
			sfx.play("clunk", 1.6, -6.0)
		elif event.is_action_pressed("hz_interact"):
			_pull_lever()


func _pull_lever() -> void:
	if not machine.lever_unlocked:
		machine.jiggle_lever()
		var lines: Array = db.bill.get("lever_locked", [])
		if not lines.is_empty():
			ui.think(String(lines[_lever_thought % lines.size()]), 3.0)
			_lever_thought += 1
		return
	_set_mode("cutscene")
	machine.machine_mode = false
	ui.show_machine_help(false)
	machine.pull_lever()
	sfx.play("lever")
	await get_tree().create_timer(0.8).timeout
	var result := puzzle.evaluate()
	state.add_fact("attempt_1")
	if state.attempts >= 2:
		state.add_fact("attempt_3")
	if result["solved"]:
		guidance.notify_attempt(true)
		machine_attempted.emit(true, result["count"])
		_finale()
		return
	machine.attempt_start()
	sfx.play("chord")
	await get_tree().create_timer(2.2).timeout
	machine.attempt_fail()
	sfx.play("clank")
	var fb := puzzle.build_wrong_feedback(result)
	var ev: Dictionary = fb["event"]
	var target := String(ev.get("target", ""))
	await get_tree().create_timer(0.5).timeout
	if target == "bill" and player:
		focus_requested.emit(player.global_position + Vector2(0, -260), 1.0)
		if player.has_method("blast_hat"):
			player.blast_hat()
		if machine:
			machine.puff(player.global_position - machine.global_position + Vector2(0, -120), 16)
		sfx.play("hiss")
	elif enclosures.has(target):
		var e: HumanZooEnclosure = enclosures[target]
		focus_requested.emit(e.global_position + Vector2(0, -260), 1.0)
		await get_tree().create_timer(0.6).timeout
		e.play_effect(String(ev.get("effect", "")))
		sfx.play("boing" if ev.get("effect", "") != "bubbles" else "pop")
	await get_tree().create_timer(1.4).timeout
	var ctx := {}
	if ev.get("effect", "") == "loud_mic":
		ctx["loud"] = target
	await _play(target if enclosures.has(target) else "", fb["lines"], ctx)
	ui.close_dialogue()
	guidance.notify_attempt(false)
	machine_attempted.emit(false, result["count"])
	_set_mode("explore")
	enter_machine()


func _finale() -> void:
	_set_mode("finale")
	state.add_fact("puzzle_solved")
	guidance.suspended = true
	ui.set_nudge_offered(false)
	sfx.set_loop("hum", 0.0)
	machine.attempt_start()
	sfx.play("chord")
	focus_requested.emit(machine.global_position + Vector2(0, -560), 0.62)
	await get_tree().create_timer(1.8).timeout
	machine.start_finale()
	sfx.play("swell")
	sfx.play("clunk", 0.7)
	if gallery:
		gallery.set_finale(1.0)
	if pipes:
		for id in puzzle.selector_ids:
			pipes.set_glow(id, 1.0)
			pipes.flash(id)
	for e in enclosures.values():
		e.set_glow(1.0)
		e.perform_action("finale", [])
	await get_tree().create_timer(7.5).timeout
	await _play("", HumanZooLines.normalize(db.finale.get("lines", [])))
	ui.close_dialogue()
	ui.show_finale(String(db.finale.get("title", "")), String(db.finale.get("subtitle", "")))
	await ui.finale_dismissed
	ui.hide_finale()
	puzzle_solved.emit()
	minigame_completed.emit()
	focus_released.emit()
	_set_mode("explore")


func _on_machine_beat(kind: String) -> void:
	match kind:
		"clunk":
			sfx.play("clunk")
		"hiss":
			sfx.play("hiss")
		"hum":
			sfx.set_loop("hum", 0.18)
		"ratchet":
			sfx.play("ratchet")


# =================================================================== guidance

func _on_guidance_notice(cid: String) -> void:
	var e: HumanZooEnclosure = enclosures.get(cid)
	if e == null:
		return
	e.notice()
	var c := db.character(cid)
	var pool: Array = c.barks.get("notice", []) if c else []
	if not pool.is_empty() and _rng.randf() < 0.6:
		e.bark(String(pool[_rng.randi() % pool.size()]), 2.0)


func _on_guidance_attention(cid: String, behaviour: String) -> void:
	var e: HumanZooEnclosure = enclosures.get(cid)
	if e:
		e.play_behaviour(behaviour, 3.0)
		var c := db.character(cid)
		var pool: Array = c.barks.get("attention", []) if c else []
		if not pool.is_empty():
			e.bark(String(pool[_rng.randi() % pool.size()]), 2.6)
	_attention_until[cid] = Time.get_ticks_msec() / 1000.0 + 7.0


func _on_nudge_available(on: bool) -> void:
	if ui:
		ui.set_nudge_offered(on)


func _on_guidance_thought(text: String) -> void:
	if mode == "explore":
		ui.think(text, 5.5)
	else:
		_queued_thoughts.append(text)


# ====================================================================== misc

func _set_mode(m: String) -> void:
	var was_locked := mode != "explore"
	mode = m
	var locked := m != "explore"
	if locked != was_locked:
		player_lock_changed.emit(locked)
		if player and player.has_method("set_locked"):
			player.set_locked(locked)
	if not locked:
		_cooldown = 0.2


## Save / load mid-puzzle.
func get_save_data() -> Dictionary:
	return state.to_dict()


func load_save_data(d: Dictionary) -> void:
	state.from_dict(d)
	_apply_visual_state(false)


## Debug (F2): force the current stage's completion facts.
func debug_skip_stage() -> void:
	if progress.all_stages_complete():
		return
	var stage := progress.current_stage()
	var eff := {"unlock": [], "set": []}
	for id in HumanZooConditions.referenced_ids(stage.get("complete_when")):
		if db.topic(id) != null:
			eff["unlock"].append(id)
		else:
			eff["set"].append(id)
	# Stage 4's voice and stage 5's question need their prerequisites too.
	if state.stage >= 3:
		eff["set"].append_array(["voice_awake", "voice_tuned", "met_empty", "reframe"])
		eff["unlock"].append("what_want")
	_after_effects("", eff)
	_play_reveals()
