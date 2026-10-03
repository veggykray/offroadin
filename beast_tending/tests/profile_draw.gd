extends Node
## Rough per-node draw cost: godot --headless --path . --fixed-fps 60 res://tests/profile_draw.tscn
var main
var n := 0
var marks := []
var totals := {}
var frames := 0
func _ready():
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
func _hook(nd):
	if nd is CanvasItem:
		nd.draw.connect(func(): marks.append([Time.get_ticks_usec(), str(nd.get_path()).replace("/root/Prof/Main/", "")]))
	for c in nd.get_children():
		_hook(c)
func _process(_d):
	n += 1
	if n == 5:
		main.cards.hide_cards()
		main._start()
		var cx := OS.get_environment("CAM")
		if cx != "":
			Game.camera.target_x = float(cx)
			Game.camera.position.x = float(cx)
	if n == 30:
		_hook(main)
	if n > 31:
		marks.sort_custom(func(a, b): return a[0] < b[0])
		for i in range(1, marks.size()):
			var dt: int = marks[i][0] - marks[i - 1][0]
			if dt < 20000:
				totals[marks[i][1]] = totals.get(marks[i][1], 0) + dt
		frames += 1
	marks.clear()
	if n == 31 + 60:
		var arr := []
		for k in totals:
			arr.append([totals[k] / float(frames), k])
		arr.sort_custom(func(a, b): return a[0] > b[0])
		var sum := 0.0
		for a in arr:
			sum += a[0]
		print("total draw %.2f ms/frame, process %.2f ms" % [sum / 1000.0, Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0])
		for a in arr.slice(0, 14):
			print("%8.0f us  %s" % a)
		get_tree().quit()
