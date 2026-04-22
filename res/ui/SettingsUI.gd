extends CanvasLayer
class_name SettingsUI

var master_slider := null
var music_slider := null
var sfx_slider := null
var vib_toggle := null
var fps_mode := null

func _ready():
    pass

func _on_master_changed(value):
    # Apply master volume to AudioServer
    # AudioServer.set_bus_volume_db(0, value)
    pass
