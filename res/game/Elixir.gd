extends Node

signal elixir_changed(new_amount: int)

@export var max_elixir: int = 10
@export var regen_per_tick: int = 1
@export var regen_interval: float = 1.0

var current_elixir: int = 4
var _regen_timer: Timer

func _ready():
	_regen_timer = Timer.new()
	add_child(_regen_timer)
	_regen_timer.wait_time = regen_interval
	_regen_timer.autostart = true
	_regen_timer.one_shot = false
	_regen_timer.timeout.connect(_on_regen)
	current_elixir = 4
	emit_signal("elixir_changed", current_elixir)

func _on_regen() -> void:
	if current_elixir < max_elixir:
		current_elixir = min(max_elixir, current_elixir + regen_per_tick)
		emit_signal("elixir_changed", current_elixir)

func can_afford(cost: int) -> bool:
	return current_elixir >= cost

func spend(amount: int) -> bool:
	if can_afford(amount):
		current_elixir -= amount
		emit_signal("elixir_changed", current_elixir)
		return true
	return false