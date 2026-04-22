extends Node2D
class_name TurretNode

export(int) var max_ammo := 5
var current_ammo := max_ammo
export(float) var fire_rate := 0.5
var _fire_timer := null
var target_unit: Node = null
export(PackedScene) var projectile_scene: PackedScene

func _ready():
    _fire_timer = Timer.new()
    add_child(_fire_timer)
    _fire_timer.wait_time = fire_rate
    _fire_timer.autostart = false
    _fire_timer.one_shot = false
    _fire_timer.connect("timeout", self, "_on_fire")

func start_firing(target: Node):
    target_unit = target
    if current_ammo > 0:
        _fire_timer.start()

func stop_firing():
    _fire_timer.stop()
    target_unit = null

func _on_fire():
    if current_ammo <= 0 or target_unit == null:
        return
    var proj = projectile_scene.instantiate()
    if proj is Node:
        get_tree().get_current_scene().add_child(proj)
        proj.global_position = global_position
        if proj.has_method("initialize"):  # optional API for aiming
            proj.call("initialize", target_unit.global_position)
    current_ammo -= 1

func reload_full():
    current_ammo = max_ammo
