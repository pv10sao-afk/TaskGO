extends Control

@export var width: float = 60.0
@export var height: float = 8.0
@export var bar_color: Color = Color.GREEN

var _hp_ratio: float = 1.0

func set_hp_ratio(ratio: float):
	_hp_ratio = clamp(ratio, 0.0, 1.0)
	queue_redraw()

func _draw():
	# BUG FIX: background was drawn AFTER the fill, covering it completely.
	# Must draw background first, then the fill on top.
	draw_rect(Rect2(Vector2.ZERO, Vector2(width, height)), Color(0, 0, 0, 0.3))
	var fill_w: float = width * _hp_ratio
	draw_rect(Rect2(Vector2.ZERO, Vector2(fill_w, height)), bar_color)
