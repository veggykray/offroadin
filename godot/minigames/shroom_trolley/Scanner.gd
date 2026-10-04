extends Area2D
## Reusable checkout scanner. Put it anywhere; anything that passes through its
## collision shape and is "scannable" gets evaluated once.
##
## WHAT COUNTS AS SCANNABLE (any one of these):
##   * the body/area has a method  get_scan_id() -> StringName
##       (optionally also is_scannable() -> bool and mark_scanned())
##   * or the node has metadata "scan_id"  (Inspector > Metadata > Add)
##   * or one of its ancestors does (so you can tag a whole prop scene)
##
## WHAT HAPPENS: the scan_id is looked up in `responses`. Unknown IDs use the
## "unknown" response. The `scanned` signal is emitted with the response so the
## game can react (count it, play the sound, show the text...).
##
## ADD NEW FUNNY THINGS LATER without touching this file:
##   $Checkout/Scanner.register_response(&"cat", {
##       "response_id": &"scan_cat", "text": "MEOW?? $0.00", "sound": &"scanner_error",
##       "color": Color.ORANGE, "category": &"none", "points": 0, "consume": false })

signal scanned(item: Node, scan_id: StringName, response: Dictionary)

## Response fields:
##   response_id  StringName  stable ID for game logic / analytics
##   text         String      what the little scanner display shows
##   sound        StringName  ShroomAudio slot name to play
##   color        Color       display colour
##   category     StringName  &"good", &"bonus", &"bad" or &"none"
##   points       int
##   consume      bool        remove the item after scanning (into the bag)
var responses := {
	&"mushroom_normal": {"response_id": &"scan_good", "text": "BEEP!", "sound": &"scanner_beep", "color": Color(0.5, 1, 0.5), "category": &"good", "points": 100, "consume": true},
	&"mushroom_bouncy": {"response_id": &"scan_good", "text": "BEEP!", "sound": &"scanner_beep", "color": Color(0.5, 0.9, 1), "category": &"good", "points": 120, "consume": true},
	&"mushroom_golden": {"response_id": &"scan_golden", "text": "DING!!", "sound": &"scanner_golden", "color": Color(1, 0.85, 0.2), "category": &"bonus", "points": 500, "consume": true},
	&"mushroom_rotten": {"response_id": &"scan_rotten", "text": "BZZZT!", "sound": &"scanner_error", "color": Color(1, 0.35, 0.3), "category": &"bad", "points": -150, "consume": true},
	&"mushroom_giant": {"response_id": &"scan_giant", "text": "PRICE CHECK?!", "sound": &"scanner_error", "color": Color(1, 0.5, 1), "category": &"none", "points": 0, "consume": false},
	# Examples for later silliness. Nothing in the prototype uses these yet.
	&"bill": {"response_id": &"scan_bill", "text": "BILL: NOT FOR SALE", "sound": &"scanner_error", "color": Color(1, 0.6, 0.2), "category": &"none", "points": 0, "consume": false},
	&"trolley": {"response_id": &"scan_trolley", "text": "TROLLEY £1 DEPOSIT", "sound": &"scanner_beep", "color": Color(0.8, 0.8, 1), "category": &"none", "points": 0, "consume": false},
	&"shoe": {"response_id": &"scan_shoe", "text": "ONE (1) SHOE", "sound": &"scanner_beep", "color": Color(0.8, 0.7, 0.5), "category": &"none", "points": 5, "consume": true},
	&"unknown": {"response_id": &"scan_unknown", "text": "UNKNOWN ITEM", "sound": &"scanner_error", "color": Color(0.9, 0.9, 0.9), "category": &"none", "points": 0, "consume": false},
}

## When false the scanner ignores everything (e.g. checkout closed).
@export var active := true
## Items that are also ignored if they've already been scanned once.
var _seen := {}


func _ready() -> void:
	monitoring = true
	body_entered.connect(_on_thing_entered)
	area_entered.connect(_on_thing_entered)


func register_response(scan_id: StringName, response: Dictionary) -> void:
	var r := (responses[&"unknown"] as Dictionary).duplicate()
	r.merge(response, true)
	responses[scan_id] = r


func get_response(scan_id: StringName) -> Dictionary:
	if responses.has(scan_id):
		return responses[scan_id]
	return responses[&"unknown"]


static func find_scan_id(node: Node) -> StringName:
	var n := node
	var depth := 0
	while n != null and depth < 4:
		if n.has_method("get_scan_id"):
			return n.get_scan_id()
		if n.has_meta("scan_id"):
			return StringName(n.get_meta("scan_id"))
		n = n.get_parent()
		depth += 1
	return &""


func _on_thing_entered(thing: Node) -> void:
	if not active:
		return
	try_scan(thing)


## Scan something manually (also used by the body/area signals).
func try_scan(thing: Node) -> bool:
	if thing == null or _seen.has(thing.get_instance_id()):
		return false
	if thing.has_method("is_scannable") and not thing.is_scannable():
		return false
	var id := find_scan_id(thing)
	if id == &"":
		return false
	_seen[thing.get_instance_id()] = true
	if thing.has_method("mark_scanned"):
		thing.mark_scanned()
	var resp := get_response(id)
	scanned.emit(thing, id, resp)
	return true


func reset_memory() -> void:
	_seen.clear()
