extends SceneTree
## Headless test suite for the Human Zoo module.
##   godot --headless --path <project> --script res://minigames/human_zoo/tests/test_human_zoo.gd
## Exits with code 0 when every check passes.

const BASE := "res://minigames/human_zoo/"

var failures := 0
var checks := 0
var _nodes: Array = []


func _initialize() -> void:
	test_scripts_load()
	test_content_valid()
	test_guided_playthrough()
	test_random_exploration_never_stuck()
	test_orders_and_alternate_routes()
	test_dead_ends_are_characterful()
	test_option_counts()
	test_puzzle_feedback()
	test_optional_chains()
	test_save_load()
	for n in _nodes:
		n.free()
	print("\n%d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)


func ok(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures += 1
		print("  FAIL: " + msg)


func fresh() -> Dictionary:
	var db := HumanZooDatabase.new()
	db.load_file(BASE + "data/human_zoo_content.json")
	var state := HumanZooState.new()
	for t in db.initial_topics:
		state.learn_topic(t)
	var conv := HumanZooConversation.new(db, state)
	var prog := HumanZooProgress.new(db, state)
	var guide := HumanZooGuidanceController.new()
	guide.setup(db, state, conv)
	_nodes.append(guide)
	return {"db": db, "state": state, "conv": conv, "prog": prog, "guide": guide}


## Mirrors HumanZooGame.talk_to without any UI: greet if needed, ask, apply.
func ask(w: Dictionary, cid: String, topic: String) -> Dictionary:
	var conv: HumanZooConversation = w["conv"]
	var state: HumanZooState = w["state"]
	var prog: HumanZooProgress = w["prog"]
	if not state.has_fact("met_" + cid):
		var g := conv.greeting(cid)
		prog.apply_effects(conv.commit(g))
	var res := conv.resolve(cid, topic)
	prog.apply_effects(conv.commit(res))
	_auto_world_facts(w)
	prog.check_stages()
	return res


## Facts the game sets from world interactions (waking + tuning the empty cage).
func _auto_world_facts(w: Dictionary) -> void:
	var db: HumanZooDatabase = w["db"]
	var state: HumanZooState = w["state"]
	var empty := db.character("empty")
	if HumanZooConditions.check(empty.awake_when, state):
		state.add_fact("voice_awake")


func tune(w: Dictionary) -> void:
	var state: HumanZooState = w["state"]
	var conv: HumanZooConversation = w["conv"]
	var prog: HumanZooProgress = w["prog"]
	state.add_fact("voice_tuned")
	var g := conv.greeting("empty")
	prog.apply_effects(conv.commit(g))
	prog.check_stages()


# ------------------------------------------------------------------------ tests

func test_scripts_load() -> void:
	print("scripts load")
	var paths: Array = []
	_collect(BASE + "scripts", paths)
	for p in paths:
		var s = load(p)
		ok(s != null and s.can_instantiate(), "script loads: " + p)


func _collect(dir: String, out: Array) -> void:
	var d := DirAccess.open(dir)
	if d == null:
		return
	for f in d.get_files():
		if f.ends_with(".gd"):
			out.append(dir.path_join(f))
	for sub in d.get_directories():
		_collect(dir.path_join(sub), out)


func test_content_valid() -> void:
	print("content validation")
	var w := fresh()
	var problems: Array = w["db"].validate()
	for p in problems:
		print("    " + p)
	ok(problems.is_empty(), "content has no validation problems")
	ok(w["db"].characters.size() == 6, "six characters")
	ok(w["db"].stages.size() == 5, "five stages")


## Follow only what the guidance controller points at. If guidance is good,
## this reaches the end without ever brute-forcing.
func test_guided_playthrough() -> void:
	print("guided playthrough")
	var w := fresh()
	var state: HumanZooState = w["state"]
	var guide: HumanZooGuidanceController = w["guide"]
	var conv: HumanZooConversation = w["conv"]
	var steps := 0
	var stage_steps: Array = []
	while state.stage < 5 and steps < 120:
		steps += 1
		var lead := guide.current_lead()
		ok(not lead.is_empty(), "guidance always has a lead (stage %d, step %d)" % [state.stage, steps])
		if lead.is_empty():
			break
		var who := String(lead.get("who", ""))
		if who == "empty" and not state.has_fact("voice_tuned") and state.has_fact("voice_awake"):
			tune(w)
			continue
		var did := false
		for p in conv.productive_pairs():
			if p["character"] == who:
				ask(w, who, p["topic"])
				did = true
				break
		if not did and who != "" and not state.has_fact("met_" + who):
			ask(w, who, HumanZooConversation.CHAT)
			did = true
		ok(did, "lead '%s' (who=%s) had something productive to ask" % [lead.get("id", "?"), who])
		if not did:
			break
		if stage_steps.size() < state.stage:
			stage_steps.append(steps)
	ok(state.stage == 5, "guided play completes all five stages (reached %d in %d steps)" % [state.stage, steps])
	print("    stages completed at steps: %s" % str(stage_steps))
	ok(state.has_fact("what_want"), "WHAT DO YOU WANT? unlocked")


## A player who clicks randomly can never get permanently stuck: at every
## point there is either something productive to ask, a dial to tune, or the
## final puzzle to solve.
func test_random_exploration_never_stuck() -> void:
	print("random exploration (never stuck)")
	var rng := RandomNumberGenerator.new()
	for run in 25:
		rng.seed = 1000 + run
		var w := fresh()
		var state: HumanZooState = w["state"]
		var conv: HumanZooConversation = w["conv"]
		var db: HumanZooDatabase = w["db"]
		var stuck := false
		for step in 1500:
			if state.stage >= 5:
				break
			var pairs := conv.productive_pairs(true)
			var tunable := state.has_fact("voice_awake") and not state.has_fact("voice_tuned")
			if pairs.is_empty() and not tunable:
				stuck = true
				print("    stuck at stage %d with topics %s" % [state.stage, str(state.topic_order)])
				break
			if tunable and rng.randf() < 0.05:
				tune(w)
				continue
			var cid: String = db.character_order[rng.randi() % db.character_order.size()]
			if not conv.is_character_available(cid):
				continue
			var opts := conv.get_options(cid)
			var pick: Dictionary = opts[rng.randi() % opts.size()]
			if pick["topic"] == HumanZooConversation.LEAVE:
				continue
			ask(w, cid, pick["topic"])
		ok(not stuck, "run %d never stuck" % run)
		ok(state.stage >= 5, "run %d reaches the final puzzle (stage %d)" % [run, state.stage])


func test_orders_and_alternate_routes() -> void:
	print("alternate routes")
	# Liar first, then Accountant: corroboration via contradiction.
	var w := fresh()
	ask(w, "accountant", "the_bells")
	ask(w, "old_woman", "third_bell")
	ask(w, "king", "king_lights")
	ok(w["state"].stage == 1, "stage 1 via accountant -> edith -> king")
	ask(w, "liar", "the_bird")
	ok(w["state"].has_fact("liar_order"), "liar gives contradictory order")
	ask(w, "accountant", "liar_order")
	ok(w["state"].stage == 2, "stage 2 via the liar's version + accountant corroboration")
	ok(w["prog"].is_misleading("liar_order"), "liar's order marked misleading once corroborated")
	# King's greeting route to the third bell, child's route too.
	var w2 := fresh()
	ask(w2, "king", "chat")
	ok(w2["state"].has_fact("third_bell"), "king's greeting mentions the third bell")
	var w3 := fresh()
	ask(w3, "child", "the_bells")
	ok(w3["state"].has_fact("third_bell"), "child's tapping gives the third bell")
	# Stage 3 facts found early cascade when stage 2 lands.
	var w4 := fresh()
	ask(w4, "accountant", "the_bells")
	ask(w4, "old_woman", "third_bell")
	ask(w4, "king", "king_lights")
	ask(w4, "old_woman", "chat")
	ask(w4, "king", "edith_message")
	ask(w4, "old_woman", "edith_dead")
	ask(w4, "king", "cup_final")
	ask(w4, "old_woman", "king_cup")
	ask(w4, "accountant", "how_long")
	ok(w4["state"].stage == 1, "time discrepancy found before symbols doesn't skip stage 2")
	ask(w4, "child", "the_bird")
	ask(w4, "accountant", "child_blocks")
	ok(w4["state"].stage == 3, "stage 2 completion cascades into stage 3")


func test_dead_ends_are_characterful() -> void:
	print("dead ends")
	var w := fresh()
	ask(w, "accountant", "the_machine")
	var conv: HumanZooConversation = w["conv"]
	w["state"].learn_topic("the_bird")
	var res := ask(w, "accountant", "the_bird")
	ok(res["kind"] == "comedy", "accountant/bird is a bespoke comedy line")
	ok(String(res["lines"][0]["text"]) == "One.", "\"One.\"")
	ok(conv.topic_status("accountant", "the_bird") == "exhausted", "repeated topic is exhausted after one dead end")
	w["state"].learn_topic("spoon")
	var res2 := ask(w, "liar", "spoon")
	ok(res2["kind"] == "dead_end", "unknown pair falls back to a character pool")
	ok(not res2["lines"].is_empty(), "fallback lines are never empty")
	for cid in w["db"].character_order:
		ok(not w["db"].character(cid).fallback.is_empty(), "%s has a fallback pool" % cid)


func test_option_counts() -> void:
	print("option counts")
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var w := fresh()
	var conv: HumanZooConversation = w["conv"]
	var db: HumanZooDatabase = w["db"]
	var max_seen := 0
	for step in 600:
		var cid: String = db.character_order[rng.randi() % 5]
		var opts := conv.get_options(cid)
		max_seen = maxi(max_seen, opts.size())
		ok(opts.size() >= 2 and opts.size() <= 5, "2-4 options + Leave at %s (got %d)" % [cid, opts.size()])
		var pick: Dictionary = opts[rng.randi() % opts.size()]
		if pick["topic"] != HumanZooConversation.LEAVE:
			ask(w, cid, pick["topic"])
	print("    max options shown: %d" % max_seen)


func test_puzzle_feedback() -> void:
	print("puzzle")
	var w := fresh()
	var state: HumanZooState = w["state"]
	state.add_fact("voice_tuned")
	var puzzle := HumanZooMachinePuzzle.new(w["db"], state)
	var res := puzzle.evaluate()
	ok(not res["solved"], "initial configuration is not solved")
	for i in 4:
		var fb := puzzle.build_wrong_feedback(puzzle.evaluate())
		ok(not fb["lines"].is_empty(), "wrong attempt %d produces reaction lines" % (i + 1))
		var has_count := false
		for l in fb["lines"]:
			if l["who"] == "accountant" and (l["text"].contains("correct")):
				has_count = true
			ok(not String(l["text"]).contains("{"), "no unfilled placeholder: " + String(l["text"]))
		ok(has_count, "accountant always reports how many were correct")
	var sol: Dictionary = w["db"].puzzle["solution"]
	for i in puzzle.selector_ids.size():
		var id: String = puzzle.selector_ids[i]
		var guard := 0
		while puzzle.symbol_for(id) != sol[id] and guard < 10:
			puzzle.rotate(i, 1)
			guard += 1
	ok(puzzle.evaluate()["solved"], "setting the data-driven solution solves the machine")


func test_optional_chains() -> void:
	print("optional chains")
	var w := fresh()
	for cid in ["king", "child", "accountant", "liar", "old_woman"]:
		ask(w, cid, "chat")
	ask(w, "old_woman", "chat")   # spoon (stage 1 not reached yet)
	ok(w["state"].has_fact("spoon"), "spoon errand offered")
	ask(w, "king", "spoon")
	ask(w, "old_woman", "spoon_confiscated")
	ask(w, "king", "spoon_why")
	ask(w, "old_woman", "spoon_reason")
	ok(w["state"].has_fact("spoon_done"), "spoon chain completes")
	ask(w, "child", "chat")
	ask(w, "old_woman", "child_drawing")
	ask(w, "child", "drawing_question")
	ask(w, "old_woman", "drawing_is_edith")
	ok(w["state"].has_fact("drawing_done"), "drawing chain completes")
	ok(w["state"].stage == 0, "optional chains never advance the main stages")


func test_save_load() -> void:
	print("save / load")
	var w := fresh()
	ask(w, "accountant", "the_bells")
	ask(w, "old_woman", "third_bell")
	var data: Dictionary = w["state"].to_dict()
	var json := JSON.stringify(data)
	var s2 := HumanZooState.new()
	s2.from_dict(JSON.parse_string(json))
	ok(s2.has_fact("king_lights"), "facts survive a JSON round trip")
	ok(s2.topic_order == w["state"].topic_order, "topic order survives")
	ok(s2.times_asked("accountant", "the_bells") == 1, "asked counts survive")
