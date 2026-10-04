class_name HumanZooLines
extends RefCounted
## Normalises the compact line syntax used in the content file.
##
##   "Finally. Staff."                    -> the character being spoken to says it
##   {"bill": "I'm not staff."}           -> Bill says it
##   {"do": "(Bill waits.)"}              -> narration / stage direction
##   {"pause": 1.2}                       -> a silent beat ("...")
##   {"as": "king", "say": "..."}         -> another character (used in reactions)
##   {"action": "child_blocks", "args": ["BIRD", "MOON", "HAND"]}
##                                         -> world action, played in sequence
##
## Normalised form: {"who": String, "text": String, "pause": float,
##                   "action": String, "args": Array}


static func normalize(raw: Array) -> Array:
	var out: Array = []
	for item in raw:
		out.append(normalize_line(item))
	return out


static func normalize_line(item) -> Dictionary:
	var line := {"who": "self", "text": "", "pause": 0.0, "action": "", "args": []}
	if item is String:
		line["text"] = item
	elif item is Dictionary:
		if item.has("bill"):
			line["who"] = "bill"
			line["text"] = String(item["bill"])
		elif item.has("do"):
			line["who"] = "narrator"
			line["text"] = String(item["do"])
		elif item.has("say"):
			line["who"] = String(item.get("as", "self"))
			line["text"] = String(item["say"])
		elif item.has("think"):
			line["who"] = "thought"
			line["text"] = String(item["think"])
		if item.has("pause"):
			line["pause"] = float(item["pause"])
		if item.has("action"):
			line["action"] = String(item["action"])
			line["args"] = Array(item.get("args", []))
	return line


static func fill(text: String, ctx: Dictionary) -> String:
	var out := text
	for k in ctx.keys():
		out = out.replace("{" + str(k) + "}", str(ctx[k]))
	return out
