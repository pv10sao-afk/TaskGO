# DropZone must extend Control — can_drop_data / drop_data are Control virtual methods
# and are NEVER called on Node2D.
extends Control

var valid_drop: bool = false
@export var lane_index: int = 0

func can_drop_data(_position: Vector2, data) -> bool:
	return data is Dictionary and data.has("type") and data["type"] == "card"

func drop_data(_position: Vector2, data):
	if not data or not data.has("card"):
		return
	var card = data["card"]
	var scene = get_tree().get_current_scene()
	if scene and scene.has_node("BattleManager"):
		var mgr = scene.get_node("BattleManager")
		if mgr.has_method("deploy_card_at_lane"):
			mgr.call("deploy_card_at_lane", card, lane_index)
