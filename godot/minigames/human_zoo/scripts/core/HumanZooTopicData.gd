class_name HumanZooTopicData
extends Resource
## One idea / message / question Bill can carry between enclosures.

@export var id: String = ""
## What appears on the microphone option, e.g. "Ask about the third bell".
@export var label: String = ""
## Short scribble on Bill's thought board, e.g. "THIRD BELL".
@export var ledger_text: String = ""
## How characters refer to it in fallback lines ("{topic}").
@export var noun: String = ""
## topic | message | claim | question | note
@export var kind: String = "topic"
## Messages: who sent it and who it is for.
@export var from_character: String = ""
@export var to_character: String = ""
## Symbols drawn next to the text on the thought board.
@export var symbols: PackedStringArray = PackedStringArray()
## Notes (e.g. desires) live on the board but are never offered as options.
@export var askable: bool = true
## Claims start as doubtful; this condition turns them into confirmed facts.
var confirmed_when = null
## Optional chains are flagged so guidance never steers toward them.
@export var optional: bool = false


static func from_dict(topic_id: String, d: Dictionary) -> HumanZooTopicData:
	var t := HumanZooTopicData.new()
	t.id = topic_id
	t.label = String(d.get("label", topic_id.capitalize()))
	t.ledger_text = String(d.get("ledger", t.label.to_upper()))
	t.noun = String(d.get("noun", t.ledger_text.to_lower()))
	t.kind = String(d.get("kind", "topic"))
	t.from_character = String(d.get("from", ""))
	t.to_character = String(d.get("to", ""))
	t.symbols = PackedStringArray(d.get("symbols", []))
	t.askable = bool(d.get("askable", t.kind != "note"))
	t.confirmed_when = d.get("confirmed_when", null)
	t.optional = bool(d.get("optional", false))
	return t
