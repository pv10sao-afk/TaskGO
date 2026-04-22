extends CanvasLayer

func _ready():
	$UI/PlayButton.pressed.connect(on_play_bot_pressed)
	$UI/DeckButton.pressed.connect(on_deck_pressed)

func on_play_bot_pressed():
	get_tree().change_scene_to_file("res://res/scenes/Game.tscn")

func on_deck_pressed():
	print("Open Deck Builder")