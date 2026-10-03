@tool
class_name DialogueLine
extends Resource
## One beat of a door's performance: optionally an expression change, optionally
## some spoken words (with audio), and the pauses around them.
##
## TEXT TAGS - put these anywhere inside `text` to time facial acting to the
## words. They are removed from the subtitle and fire at roughly the moment that
## part of the sentence is spoken:
##   [expr:annoyed]  [expr:annoyed:0.5]   change expression (optional intensity)
##   [brow_raise] [brow_furrow] [squint] [widen]
##   [blink] [slow_blink] [double_blink]
##   [glance_away] [glance:left|right|up|down] [look_away] [look_at_player]
##   [look_up_down]   looks the player up and down
##   [nod] [shake] [recoil]
##   [open_door] [close_door]
## A line with only tags and no words is an "acting only" beat; it lasts
## `hold_after` seconds.

## What the door says. Leave empty for a silent beat.
@export_multiline var text := ""
## Recorded line (WAV or OGG). Leave empty to fake it from the text.
@export var audio: AudioStream
## Optional Rhubarb Lip Sync export for `audio` (gives phoneme-accurate mouth shapes).
@export_file("*.tsv", "*.txt") var lip_sync_cues := ""

@export_group("Acting")
## Expression set at the start of the line ("" keeps the current one).
@export var expression: StringName = &""
@export_range(0.0, 1.0) var expression_intensity := 1.0
## Expression set when the line ends ("" keeps it).
@export var end_expression: StringName = &""

@export_group("Timing")
## Pause before anything happens.
@export var delay_before := 0.0
## Pause after the words finish (or the length of a silent beat).
@export var hold_after := 0.6
## Speaking speed for text-only lines (no audio).
@export var text_speed := 1.0
@export var show_subtitle := true


static func make(p_text: String, p_expression: StringName = &"", p_hold := 0.6, p_audio: AudioStream = null) -> DialogueLine:
	var l := DialogueLine.new()
	l.text = p_text
	l.expression = p_expression
	l.hold_after = p_hold
	l.audio = p_audio
	return l


## Splits `text` into the subtitle and a list of {"pos": 0..1, "tag": String, "args": PackedStringArray}.
func parse() -> Dictionary:
	var clean := ""
	var tags: Array = []
	var i := 0
	while i < text.length():
		var c := text[i]
		if c == "[":
			var close := text.find("]", i)
			if close > i:
				var body := text.substr(i + 1, close - i - 1).strip_edges()
				var parts := body.split(":")
				tags.append({"char": clean.length(), "tag": parts[0].strip_edges().to_lower(), "args": parts.slice(1)})
				i = close + 1
				continue
		clean += c
		i += 1
	clean = clean.strip_edges()
	# remove doubled spaces left behind by tags
	while clean.contains("  "):
		clean = clean.replace("  ", " ")
	var n := maxf(float(clean.length()), 1.0)
	for t in tags:
		t["pos"] = clampf(float(t.char) / n, 0.0, 1.0)
	return {"text": clean, "tags": tags}
