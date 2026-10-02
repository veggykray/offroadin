class_name ScareDirector
extends Node
## Evaluates child ScareEvents every frame against the game's ScareContext.
## Scares are data (child nodes), not hardcoded into progression: add, remove, reorder or
## disable them in the scene.

signal scare_triggered(event_id: String)

@export var enabled := true
## Node exposing a `scare_context: ScareContext` property (DarkVoid).
@export var game_path: NodePath = ^".."

var _game: Node


func _ready() -> void:
	_game = get_node_or_null(game_path)


func _process(delta: float) -> void:
	var ctx := _context()
	if not enabled or ctx == null:
		return
	for ev in get_events():
		ev.tick(delta, ctx)
		if ev.is_ready() and ev.can_trigger(ctx) and ev.fire(ctx):
			scare_triggered.emit(ev.event_id)


func get_events() -> Array[ScareEvent]:
	var out: Array[ScareEvent] = []
	for c in get_children():
		if c is ScareEvent:
			out.append(c)
	return out


## Debug: fire an event now, ignoring its timing conditions. Empty id = first enabled one.
func force_trigger(event_id := "") -> bool:
	var ctx := _context()
	if ctx == null:
		return false
	for ev in get_events():
		if not ev.enabled or (event_id != "" and ev.event_id != event_id):
			continue
		if ev.can_force(ctx) and ev.fire(ctx):
			scare_triggered.emit(ev.event_id)
			return true
	return false


func _context() -> ScareContext:
	if _game == null:
		return null
	return _game.get("scare_context") as ScareContext
