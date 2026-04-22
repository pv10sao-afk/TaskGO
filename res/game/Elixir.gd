extends Node
class_name Elixir

signal elixir_changed(int new_amount)

export(int) var max_elixir := 10
export(int) var regen_per_tick := 1
export(float) var regen_interval := 1.0

var current_elixir := 4
var _regen_timer := null

func _ready():
    _regen_timer = Timer.new()
    add_child(_regen_timer)
    _regen_timer.wait_time = regen_interval
    _regen_timer.autostart = true
    _regen_timer.one_shot = false
    _regen_timer.connect("timeout", self, "_on_regen")
    # Initialize with some starting elixir for quick starts
    current_elixir = 4
    emit_signal("elixir_changed", current_elixir)

func _on_regen():
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
