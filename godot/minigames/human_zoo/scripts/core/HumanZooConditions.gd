class_name HumanZooConditions
extends RefCounted
## Evaluates the small condition language used throughout the content data.
##
## A condition can be:
##   null / ""              -> always true
##   "fact_id"              -> true when the fact (topic or flag) is known
##   "!fact_id"             -> true when the fact is NOT known
##   ["a", "b", "!c"]       -> all must hold
##   {"all": [...], "any": [...], "none": [...], "min_stage": 2}
## Topics and flags share one namespace, so a condition never needs to know
## whether something was learned in conversation or set by an event.


static func check(cond, state) -> bool:
	if cond == null:
		return true
	match typeof(cond):
		TYPE_STRING, TYPE_STRING_NAME:
			var s := String(cond)
			if s == "":
				return true
			if s.begins_with("!"):
				return not state.has_fact(s.substr(1))
			return state.has_fact(s)
		TYPE_ARRAY:
			for c in cond:
				if not check(c, state):
					return false
			return true
		TYPE_DICTIONARY:
			if cond.has("all") and not check(cond["all"], state):
				return false
			if cond.has("any"):
				var any_ok := false
				for c in cond["any"]:
					if check(c, state):
						any_ok = true
						break
				if not any_ok:
					return false
			if cond.has("none"):
				for c in cond["none"]:
					if check(c, state):
						return false
			if cond.has("min_stage") and state.stage < int(cond["min_stage"]):
				return false
			return true
	return true


## "until" style checks: a missing condition means "never satisfied".
static func check_until(cond, state) -> bool:
	if cond == null or (typeof(cond) == TYPE_STRING and cond == ""):
		return false
	return check(cond, state)


## Every fact id referenced by a condition (used by the data validator).
static func referenced_ids(cond) -> Array:
	var out: Array = []
	if cond == null:
		return out
	match typeof(cond):
		TYPE_STRING, TYPE_STRING_NAME:
			var s := String(cond)
			if s != "":
				out.append(s.trim_prefix("!"))
		TYPE_ARRAY:
			for c in cond:
				out.append_array(referenced_ids(c))
		TYPE_DICTIONARY:
			for k in ["all", "any", "none"]:
				if cond.has(k):
					out.append_array(referenced_ids(cond[k]))
	return out
