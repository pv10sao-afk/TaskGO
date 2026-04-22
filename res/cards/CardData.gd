class_name CardData
extends Resource  # BUG FIX: was "extends Node" — .tres files are Resources, not Nodes

var id: String = ""
var cost: int = 1
var icon: Texture2D
var description: String = ""
var packed_scene: PackedScene
