extends Node

signal deploy_validated(is_valid: bool, position: Vector2)
signal unit_deployed(unit: Node)

const CENTER_Y: float = 640.0

func deploy_card_at_lane(card: Resource, lane_index: int) -> void:
	if not card:
		return

	var spawn_pos: Vector2 = _lane_spawn_position(lane_index)
	if not _is_valid_deploy_position(spawn_pos):
		push_warning("Deploy position outside player zone: %s" % str(spawn_pos))
		emit_signal("deploy_validated", false, spawn_pos)
		return

	emit_signal("deploy_validated", true, spawn_pos)

	var scene_node: Node = null

	if card.packed_scene:
		scene_node = card.packed_scene.instantiate()
	else:
		# FIX: packed_scene is null — spawn a visual placeholder so the card
		# actually appears on the field instead of silently doing nothing.
		scene_node = _make_placeholder_unit(card)

	if scene_node:
		scene_node.position = spawn_pos
		get_tree().get_current_scene().add_child(scene_node)
		emit_signal("unit_deployed", scene_node)

func _make_placeholder_unit(card: Resource) -> Node2D:
	# Creates a simple colored rectangle as a stand-in for a real unit scene.
	var root = Node2D.new()
	root.name = "Unit_" + str(card.id)

	var rect = ColorRect.new()
	rect.size = Vector2(60, 80)
	rect.position = Vector2(-30, -40)

	# Color by card type
	if card is UnitCardData:
		rect.color = Color(0.2, 0.5, 1.0, 0.9)   # blue = friendly unit
	elif card is SpellCardData:
		rect.color = Color(1.0, 0.4, 0.1, 0.9)   # orange = spell
	elif card is BuildingCardData:
		rect.color = Color(0.5, 0.8, 0.3, 0.9)   # green = building
	else:
		rect.color = Color(0.7, 0.7, 0.7, 0.9)

	var label = Label.new()
	label.text = card.id.replace("_", "\n")
	label.add_theme_font_size_override("font_size", 14)
	label.position = Vector2(-28, -38)
	label.size = Vector2(56, 76)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	root.add_child(rect)
	root.add_child(label)
	return root

func _lane_spawn_position(lane_index: int) -> Vector2:
	var scene: Node = get_tree().get_current_scene()
	var path: String = "Lanes/Lane%s/SpawnMarker" % str(clamp(lane_index, 0, 2))
	if scene and scene.has_node(path):
		var marker = scene.get_node(path)
		if marker and marker is Marker2D:
			return marker.global_position
	var lane_x: Array = [120.0, 360.0, 600.0]
	var x: float = lane_x[clamp(lane_index, 0, lane_x.size() - 1)]
	return Vector2(x, 870.0)

func _is_valid_deploy_position(pos: Vector2) -> bool:
	return pos.y > CENTER_Y
