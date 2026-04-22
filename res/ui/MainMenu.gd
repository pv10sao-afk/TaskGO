extends CanvasLayer

func _ready():
	pass

func on_play_bot_pressed():
	# BUG FIX: path was "res://scenes/Game.tscn" — project files live under
	# the res/ subfolder, so the correct path is "res://res/scenes/Game.tscn"
	get_tree().change_scene_to_file("res://res/scenes/Game.tscn")

func on_deck_pressed():
	print("Open Deck Builder")

func on_settings_pressed():
	var s = get_node_or_null("../SettingsUI")
	if s:
		s.visible = not s.visible
