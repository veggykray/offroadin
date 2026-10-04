extends Node2D
## Builds a complete, playable Human Zoo gallery for testing the module.
## Nothing here is required by the module: the real scene will place its own
## enclosures/stations/machine and register them with HumanZooGame.
##
## The arrangement is configurable: reorder `layout` (use "@machine" for the
## central machine) and the gallery, pipes and Bill's walking bounds follow.

@export var layout: PackedStringArray = PackedStringArray(["king", "child", "accountant", "@machine", "liar", "old_woman", "empty"])
@export var cage_spacing := 480.0
@export var cage_width := 400.0
@export var cage_height := 440.0
@export var machine_slot := 960.0
@export var station_offset := 150.0
@export var start_x := 300.0

var game: HumanZooGame
var bill: HumanZooPlaceholderBill
var camera: HumanZooTestCamera


func _ready() -> void:
	game = HumanZooGame.new()
	game.name = "HumanZooGame"
	add_child(game)

	var gallery := HumanZooGallery.new()
	gallery.name = "Gallery"
	gallery.ceiling = -930.0
	add_child(gallery)

	var world := Node2D.new()
	world.name = "World"
	add_child(world)

	# Lay out the slots left to right.
	var x := start_x
	var cage_x: Dictionary = {}
	var machine_x := 0.0
	var slots: Array = []
	for i in layout.size():
		var id := String(layout[i])
		var w := machine_slot if id == "@machine" else cage_spacing
		var cx := x + w * 0.5
		if id == "@machine":
			machine_x = cx
		else:
			cage_x[id] = cx
		slots.append(cx)
		x += w
	var right := x + start_x
	gallery.left = -600.0
	gallery.right = right + 600.0
	gallery.machine_x = machine_x
	for i in range(1, slots.size()):
		gallery.columns.append((slots[i - 1] + slots[i]) * 0.5)
	for id in cage_x.keys():
		gallery.lamps.append(cage_x[id])

	var palette := {"king": Color(0.28, 0.16, 0.26), "child": Color(0.3, 0.33, 0.24), "accountant": Color(0.2, 0.26, 0.24),
		"liar": Color(0.34, 0.2, 0.17), "old_woman": Color(0.33, 0.26, 0.2), "empty": Color(0.17, 0.18, 0.21)}
	for id in cage_x.keys():
		var e := HumanZooEnclosure.new()
		e.name = "Enclosure_" + id
		e.character_id = id
		e.width = cage_width
		e.height = cage_height
		e.wall_color = palette.get(id, Color(0.25, 0.22, 0.2))
		e.position = Vector2(cage_x[id], -78)
		world.add_child(e)
		game.register_enclosure(e)

	var machine := HumanZooCentralMachine.new()
	machine.name = "CentralMachine"
	machine.selector_ids = game.puzzle.selector_ids
	machine.symbols = game.puzzle.symbols
	machine.position = Vector2(machine_x, 0)
	world.add_child(machine)
	game.register_machine(machine)

	var pipes := HumanZooPipes.new()
	pipes.name = "Pipes"
	world.add_child(pipes)
	game.register_pipes(pipes)

	var routes: Array = []
	var left_ids: Array = []
	var right_ids: Array = []
	for id in cage_x.keys():
		var st := HumanZooCommStation.new()
		st.name = "Station_" + id
		st.character_id = id
		st.big_tuning_dial = id == "empty"
		st.position = Vector2(cage_x[id] + station_offset, 0)
		world.add_child(st)
		game.register_station(st)
		if cage_x[id] < machine_x:
			left_ids.append(id)
		else:
			right_ids.append(id)
	# Nearest station gets the shallowest lane and the outermost entry, so pipes never cross.
	left_ids.sort_custom(func(a, b): return cage_x[a] > cage_x[b])
	right_ids.sort_custom(func(a, b): return cage_x[a] < cage_x[b])
	for side in [[left_ids, -1.0], [right_ids, 1.0]]:
		var ids: Array = side[0]
		for lane in ids.size():
			var id: String = ids[lane]
			routes.append({"id": id, "from": Vector2(cage_x[id] + station_offset + 21, 14),
				"to": Vector2(machine_x + side[1] * (300.0 - lane * 40.0), 0), "lane": lane})
	pipes.set_routes(routes)

	bill = HumanZooPlaceholderBill.new()
	bill.name = "Bill"
	bill.min_x = start_x - 120
	bill.max_x = right - start_x + 120
	bill.position = Vector2(cage_x.get(layout[0], start_x) + 40, 0)
	world.add_child(bill)

	camera = HumanZooTestCamera.new()
	camera.name = "Camera"
	camera.target = bill
	camera.min_x = gallery.left + 960
	camera.max_x = gallery.right - 960
	add_child(camera)
	camera.make_current()
	game.focus_requested.connect(camera.focus_on)
	game.focus_released.connect(camera.release)
	game.machine_mode_changed.connect(func(active: bool, operator_position: Vector2):
		if active:
			create_tween().tween_property(bill, "position:x", operator_position.x, 0.5).set_trans(Tween.TRANS_SINE))

	game.register_gallery(gallery)
	game.player = bill
	game.minigame_completed.connect(func(): print("HumanZoo: minigame_completed"))
	game.start()
	# Automated play-through for testing: run with "-- --hz-bot".
	if OS.get_cmdline_user_args().has("--hz-bot"):
		var bot: Node = load("res://minigames/human_zoo/tests/HumanZooBot.gd").new()
		bot.set("scene", self)
		add_child(bot)
