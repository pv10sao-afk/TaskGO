extends Node2D
class_name TurretNode

@export var max_ammo: int = 5
@export var fire_rate: float = 0.5
@export var projectile_scene: PackedScene

var current_ammo: int = max_ammo
var _fire_timer: Timer
var target_unit: Node = null

func _ready():
	_fire_timer = Timer.new()
	add_child(_fire_timer)
	_fire_timer.wait_time = fire_rate
	_fire_timer.autostart = false
	_fire_timer.one_shot = false
	_fire_timer.timeout.connect(_on_fire)

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
		if proj.has_method("initialize"):
			proj.call("initialize", target_unit.global_position)
	current_ammo -= 1

func reload_full():
	current_ammo = max_ammo