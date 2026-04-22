extends Node2D

@export var max_ammo: int = 5
@export var fire_rate: float = 0.5
@export var projectile_scene: PackedScene

# BUG FIX: "var current_ammo: int = max_ammo" was evaluated before _ready(),
# so it always used the class default (5), ignoring any Inspector value.
var current_ammo: int = 0
var _fire_timer: Timer
var target_unit: Node = null

func _ready():
	current_ammo = max_ammo  # BUG FIX: set here so Inspector value is respected
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
	# BUG FIX: missing is_instance_valid — target could be freed (dead) between shots
	if current_ammo <= 0 or target_unit == null or not is_instance_valid(target_unit):
		# BUG FIX: timer was never stopped when ammo ran out — it kept ticking forever
		stop_firing()
		return
	if not projectile_scene:
		return
	var proj = projectile_scene.instantiate()
	if proj is Node:
		get_tree().get_current_scene().add_child(proj)
		proj.global_position = global_position
		if proj.has_method("initialize"):
			proj.call("initialize", target_unit.global_position)
	current_ammo -= 1
	if current_ammo <= 0:
		stop_firing()  # BUG FIX: stop timer once ammo is exhausted

func reload_full():
	current_ammo = max_ammo
