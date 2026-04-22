class_name DropZone extends Node2D

var valid_drop: bool = false

func _unhandled_input(event):
	pass

func can_drop_data(_position: Vector2, data) -> bool:
	return data is Dictionary and data.has("type") and data["type"] == "card"

func drop_data(_position: Vector2, data):
	if not data or not data.has("card"):
		return
	var card = data["card"]
	var mgr = get_node("/root/BattleManager") if has_node("/root/BattleManager") else null
	if mgr and mgr.has_method("deploy_card_at_lane"):
		mgr.call("deploy_card_at_lane", card, 0)