class_name CausalClockMemoryLibrary
extends RefCounted
## Loads swappable narrative content ("memories") from JSON.
##
## The puzzle never hard-codes story content: milestones in a layout only
## refer to a memory_id, and this library resolves the id to whatever the
## memories file says (label, date text, icon, video clip, description).
## Swap the file (or point CausalClockGame.memories_path at another one) to
## replace all placeholder content without touching code.


class Memory:
	var id: String = ""
	var label: String = ""
	var date_text: String = ""
	var icon_path: String = ""
	var video_path: String = ""
	var description_text: String = ""
	## Any extra keys from the JSON, for host projects that need more fields.
	var extra: Dictionary = {}

	func has_icon() -> bool:
		return icon_path != "" and ResourceLoader.exists(icon_path)

	func has_video() -> bool:
		return video_path != "" and ResourceLoader.exists(video_path)

	func load_icon() -> Texture2D:
		if not has_icon():
			return null
		return load(icon_path) as Texture2D

	func load_video() -> VideoStream:
		if not has_video():
			return null
		return load(video_path) as VideoStream


var source_path: String = ""
var errors: PackedStringArray = PackedStringArray()
var _by_id: Dictionary = {}
var _order: Array[String] = []


static func load_from_file(path: String) -> CausalClockMemoryLibrary:
	var lib := CausalClockMemoryLibrary.new()
	lib.source_path = path
	if not FileAccess.file_exists(path):
		lib.errors.append("Memory file not found: %s" % path)
		return lib
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		lib.errors.append("%s: JSON error line %d: %s" % [path, json.get_error_line(), json.get_error_message()])
		return lib
	var data = json.data
	var list: Array = []
	if typeof(data) == TYPE_DICTIONARY:
		list = data.get("memories", [])
	elif typeof(data) == TYPE_ARRAY:
		list = data
	for md in list:
		if typeof(md) == TYPE_DICTIONARY:
			lib.add(lib._from_dict(md))
	return lib


func _from_dict(md: Dictionary) -> Memory:
	var m := Memory.new()
	m.id = str(md.get("id", "memory_%d" % _order.size()))
	m.label = str(md.get("label", m.id))
	m.date_text = str(md.get("date_text", ""))
	m.icon_path = str(md.get("icon_path", ""))
	m.video_path = str(md.get("video_path", ""))
	m.description_text = str(md.get("description_text", ""))
	for k in md.keys():
		if not k in ["id", "label", "date_text", "icon_path", "video_path", "description_text"]:
			m.extra[k] = md[k]
	return m


## Add or replace a memory at runtime (e.g. from a host project's own data).
func add(m: Memory) -> void:
	if not _by_id.has(m.id):
		_order.append(m.id)
	_by_id[m.id] = m


func has(id: String) -> bool:
	return _by_id.has(id)


## Never returns null: unknown ids produce a clearly-marked placeholder so a
## missing entry is visible in play rather than crashing.
func get_memory(id: String) -> Memory:
	if _by_id.has(id):
		return _by_id[id]
	var m := Memory.new()
	m.id = id
	m.label = "Unwritten memory"
	m.date_text = "—"
	m.description_text = "No content is defined for memory id '%s' yet." % id
	return m


func ids() -> Array[String]:
	return _order.duplicate()
