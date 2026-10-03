@tool
class_name FaceExpressionSet
extends Resource
## A named collection of FaceExpressions. Every TalkingDoorFace uses one; a door
## character can supply its own set to give the same face a different "acting
## style" (e.g. a depressed door whose HAPPY is barely a smile).

@export var expressions: Array[FaceExpression] = []


func get_expression(expression_name: StringName) -> FaceExpression:
	var key := StringName(String(expression_name).to_lower())
	for e in expressions:
		if e and e.name == key:
			return e
	return null


func get_names() -> PackedStringArray:
	var out := PackedStringArray()
	for e in expressions:
		if e:
			out.append(String(e.name))
	return out
