extends CanvasLayer
class_name MainMenu

func _ready():
    pass

func on_play_bot_pressed():
    get_tree().change_scene("res://scenes/Game.tscn")

func on_deck_pressed():
    print("Open Deck Builder")

func on_settings_pressed():
    var s = get_node("../SettingsUI") if has_node("../SettingsUI") else null
    if s:
        s.visible = not s.visible
