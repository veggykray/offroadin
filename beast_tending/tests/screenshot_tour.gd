extends Node
## Visual check: runs the real game, skips the title card, tours the beast and
## saves screenshots to tests/out/. Run:
##   godot --path . --fixed-fps 30 res://tests/screenshot_tour.tscn

const OUT := "res://tests/out/"

var main: Node
var frame := 0
var steps: Array = []
var step_i := 0
var wait := 0


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	var only := OS.get_environment("SHOTS")
	steps = [
		["wait", 50], ["shot", "title"],
		["start"], ["wait", 20],
	]
	for x in [4850, 3550, 2300, 1000, 6100, 7250]:
		steps.append(["cam", x])
		steps.append(["wait", 40])
		steps.append(["shot", "region_%d" % x])
	steps += [
		["debug", true], ["cam", 4850], ["wait", 30], ["shot", "debug_fold"], ["debug", false],
		["skip"], ["cam", 2300], ["wait", 120], ["shot", "flap_open"],
		["skip"], ["cam", 6100], ["wait", 90], ["shot", "nodules_awake"],
		["skip"], ["escalate", 0.75], ["cam", 3550], ["wait", 60], ["shot", "combo_fur"],
		["skip"], ["escalate", 0.95], ["wait", 60], ["shot", "finish_fur"],
		["skip"], ["wait", 140], ["shot", "climax_release"],
		["wait", 200], ["shot", "afterglow"],
		["wait", 300], ["shot", "end_card"],
		["quit"],
	]
	if only != "":
		# SHOTS=quick: just the regions, for fast art iteration.
		steps = [["wait", 30], ["start"], ["wait", 10]]
		for x in [4850, 3550, 2300, 1000, 6100, 7250]:
			steps.append(["cam", x])
			steps.append(["wait", 30])
			steps.append(["shot", "region_%d" % x])
		steps += [["skip"], ["cam", 2300], ["wait", 120], ["shot", "flap_open"], ["quit"]]


var _proc_sum := 0.0
var _proc_max := 0.0
var _proc_n := 0


func _process(_delta: float) -> void:
	frame += 1
	if frame > 20:
		var pt := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		_proc_sum += pt
		_proc_max = maxf(_proc_max, pt)
		_proc_n += 1
	if wait > 0:
		wait -= 1
		return
	if step_i >= steps.size():
		return
	var s: Array = steps[step_i]
	step_i += 1
	match s[0]:
		"wait":
			wait = s[1]
		"start":
			main.cards.hide_cards()
			main._start()
		"cam":
			Game.camera.target_x = s[1]
			Game.camera.position.x = s[1]
		"shot":
			var img := get_viewport().get_texture().get_image()
			img.save_png(ProjectSettings.globalize_path(OUT + s[1] + ".png"))
			print("shot ", s[1], " frame ", frame)
		"debug":
			Game.debug = s[1]
		"skip":
			Game.sequence.skip_stage()
		"escalate":
			Game.mind.escalation_override = s[1]
		"quit":
			print("script process time: avg %.2f ms, max %.2f ms over %d frames" % [_proc_sum / maxi(_proc_n, 1), _proc_max, _proc_n])
			get_tree().quit()
