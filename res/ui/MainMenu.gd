class_name MainMenu extends CanvasLayer

func _ready():
	pass

func on_play_bot_pressed():
	get_tree().change_scene_to_file("res://scenes/Game.tscn")

func on_deck_pressed():
	print("Open Deck Builder")

func on_settings_pressed():
	var s = get_node_or_null("../SettingsUI")
	if s:
		s.visible = not s.visible