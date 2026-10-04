extends Node
## Plays the test scene end-to-end through the real UI, following the guidance
## controller like an attentive player would, and optionally saves screenshots.
## Launch: godot --path <project> res://minigames/human_zoo/scenes/HumanZooTest.tscn -- --hz-bot [--hz-shots=/abs/dir] [--hz-speed=3]

var scene: Node
var game: HumanZooGame
var bill: Node2D
var shots_dir := ""
var _talking := ""
var _wait := 0.0
var _shot_index := 0
var _shots_taken: Dictionary = {}
var _attempts := 0
var _t := 0.0
var _last_mode := ""
var _mode_t := 0.0
var _board_shown := false
var _done := false


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--hz-shots="):
			shots_dir = a.trim_prefix("--hz-shots=")
			DirAccess.make_dir_recursive_absolute(shots_dir)
		elif a.begins_with("--hz-speed="):
			Engine.time_scale = float(a.trim_prefix("--hz-speed="))
	game = scene.game
	bill = scene.bill
	game.conversation_started.connect(func(c): _talking = c)
	game.stage_completed.connect(func(n, name): print("BOT: stage %d complete — %s (t=%.0fs)" % [n, name, _t]))
	game.minigame_completed.connect(func():
		print("BOT: minigame completed after %d lever pulls (t=%.0fs)" % [_attempts, _t])
		_done = true)


func shot(tag: String) -> void:
	if shots_dir == "" or _shots_taken.has(tag):
		return
	_shots_taken[tag] = true
	_shot_index += 1
	var img := get_viewport().get_texture().get_image()
	img.save_png(shots_dir.path_join("%02d_%s.png" % [_shot_index, tag]))
	print("BOT: screenshot " + tag)


func _process(delta: float) -> void:
	_t += delta
	if game.mode != _last_mode:
		_last_mode = game.mode
		_mode_t = 0.0
	_mode_t += delta
	if _done:
		if _mode_t > 1.0:
			shot("after_finale")
			get_tree().quit(0)
		return
	if _t > 1500.0:
		print("BOT: TIMEOUT at stage %d" % game.state.stage)
		get_tree().quit(1)
		return
	if _t < 2.5:
		if _t > 2.0:
			shot("start")
		return
	_wait -= delta
	if _wait > 0.0:
		return
	match game.mode:
		"explore":
			_explore()
		"dialogue":
			_dialogue()
		"tuning":
			_tuning()
		"machine":
			_machine()
		"cutscene":
			_dialogue()
			if _mode_t > 2.6:
				shot("reveal_stage_%d" % game.state.stage)
			if _mode_t > 3.5 and game.state.attempts > 0:
				shot("wrong_attempt_%d" % game.state.attempts)
		"finale":
			if _mode_t > 9.5:
				shot("finale_tree")
			_dialogue()
			if game.ui._finale_waiting:
				shot("finale_card")
				game.ui._finale_waiting = false
				game.ui.finale_dismissed.emit()


func _target() -> String:
	var st := game.state
	if st.stage >= 5:
		return "@machine"
	var lead := game.guidance.current_lead()
	var who := String(lead.get("who", ""))
	if who == "" or (not game.conversation.is_character_available(who) and who != "empty"):
		var pairs := game.conversation.productive_pairs()
		if not pairs.is_empty():
			who = pairs[0]["character"]
	return who


func _explore() -> void:
	if game.state.stage >= 2 and not _board_shown:
		_board_shown = true
		game.ui.toggle_board()
		_wait = 0.6
		await get_tree().create_timer(0.5).timeout
		shot("thought_board")
		game.ui.toggle_board()
		return
	var who := _target()
	var tx: float
	if who == "@machine":
		tx = game.machine.global_position.x
	elif game.stations.has(who):
		tx = game.stations[who].global_position.x
	else:
		return
	var dx := tx - bill.global_position.x
	if absf(dx) > 30.0:
		bill.position.x += signf(dx) * minf(absf(dx), 380.0 * get_process_delta_time())
		return
	if who == "@machine":
		game.enter_machine()
	else:
		game.talk_to(who)
	_wait = 0.3


func _dialogue() -> void:
	var ui := game.ui
	if ui._waiting_line:
		if ui._typing:
			return
		if _talking != "" and not _shots_taken.has("dialogue_" + _talking) and game.mode == "dialogue":
			shot("dialogue_" + _talking)
		ui._advance()
		_wait = 0.15
	elif ui._choosing:
		if not _shots_taken.has("options_" + _talking):
			shot("options_" + _talking)
		var conv := game.conversation
		var pick := ui._options.size() - 1
		for i in ui._options.size():
			var t := String(ui._options[i]["topic"])
			if t != HumanZooConversation.LEAVE and conv.has_productive(_talking, t):
				var td := game.db.topic(t)
				if t == HumanZooConversation.CHAT or td == null or not td.optional:
					pick = i
					break
		ui._choosing = true
		ui._pick(pick)
		_wait = 0.2


func _tuning() -> void:
	var dial := game.ui.tuning
	dial.value = move_toward(dial.value, dial.target, get_process_delta_time() * 0.12)
	if absf(dial.value - dial.target) < 0.08:
		shot("tuning")


func _machine() -> void:
	if _mode_t < 1.2:
		return
	shot("machine_mode_%d" % _attempts)
	var puzzle := game.puzzle
	var sol: Dictionary = game.db.puzzle["solution"]
	# First attempt: deliberately get two right so the wrong-answer flow plays.
	var want := {}
	for id in puzzle.selector_ids:
		want[id] = sol[id]
	if _attempts == 0:
		want["liar"] = "EYE"
		want["empty"] = "MOON"
		want["child"] = "BIRD"
		want["old_woman"] = "KEY"
	for i in puzzle.selector_ids.size():
		var id: String = puzzle.selector_ids[i]
		if puzzle.symbol_for(id) != want[id]:
			game.machine.selected = i
			var sym := puzzle.rotate(i, 1)
			game.machine.set_selector(i, sym)
			game.sfx.play("ratchet")
			_wait = 0.12
			return
	game.machine.selected = puzzle.selector_ids.size()
	_attempts += 1
	_wait = 0.5
	game._pull_lever()
