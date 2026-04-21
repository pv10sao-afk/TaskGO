package com.cardtowerdefense;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;

import java.util.List;

/**
 * A single deployed unit on the playfield.
 *
 * Special mechanics
 * ─────────────────
 *   FREEZE  (Mage)       — sets target.freezeTimer on hit; frozen units can't move or attack
 *   AOE_FIRE (Dragon)    — on each attack, damages ALL hostile units within aoeRadius
 *   AOE_BOMB (Bombardier)— same as AOE_FIRE but larger radius
 */
public class Unit implements IDamageable {

    // ── Identity ──────────────────────────────────────────────────────────────
    private final UnitType type;
    private final boolean  enemy;

    // ── Position ──────────────────────────────────────────────────────────────
    private float x;
    private float y;

    // ── Stats ─────────────────────────────────────────────────────────────────
    private int   hp;
    private float attackTimer;
    private boolean dead;

    // ── Status effects ────────────────────────────────────────────────────────
    /** Remaining seconds this unit is frozen (cannot move or attack). */
    private float freezeTimer = 0f;

    // ── State ─────────────────────────────────────────────────────────────────
    private IDamageable target;

    // ── Paints ────────────────────────────────────────────────────────────────
    private static final Paint BODY_PAINT    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint OUTLINE_PAINT = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint ICON_PAINT    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint HP_BG_PAINT   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint HP_FG_PAINT   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint FREEZE_PAINT  = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint AOE_PAINT     = new Paint(Paint.ANTI_ALIAS_FLAG);

    static {
        OUTLINE_PAINT.setStyle(Paint.Style.STROKE);
        OUTLINE_PAINT.setStrokeWidth(2.5f);

        ICON_PAINT.setTextAlign(Paint.Align.CENTER);
        ICON_PAINT.setTypeface(Typeface.DEFAULT_BOLD);

        HP_BG_PAINT.setColor(Color.argb(180, 30, 30, 30));

        FREEZE_PAINT.setColor(Color.argb(120, 100, 200, 255));
        FREEZE_PAINT.setStyle(Paint.Style.FILL);

        AOE_PAINT.setStyle(Paint.Style.STROKE);
        AOE_PAINT.setStrokeWidth(2f);
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    public Unit(UnitType type, boolean enemy, float x, float y) {
        this.type = type;
        this.enemy = enemy;
        this.x = x;
        this.y = y;
        this.hp = type.maxHp;
    }

    // ── IDamageable ───────────────────────────────────────────────────────────
    @Override public void    takeDamage(int amount) { hp = Math.max(0, hp - amount); if (hp == 0) dead = true; }
    @Override public boolean isDead()   { return dead; }
    @Override public float   getX()     { return x; }
    @Override public float   getY()     { return y; }
    @Override public boolean isEnemy()  { return enemy; }

    // ── Status effect setters ─────────────────────────────────────────────────
    public void applyFreeze(float duration) {
        freezeTimer = Math.max(freezeTimer, duration);
    }

    public boolean isFrozen() { return freezeTimer > 0f; }

    // ── Accessors ─────────────────────────────────────────────────────────────
    public UnitType getType() { return type; }

    // ── Update ────────────────────────────────────────────────────────────────
    public void update(float dt,
                       List<Unit> allUnits,
                       MainBase playerBase,
                       MainBase enemyBase,
                       float screenH) {
        if (dead) return;

        // Tick freeze
        if (freezeTimer > 0f) {
            freezeTimer = Math.max(0f, freezeTimer - dt);
            return;   // frozen: skip movement and attacks
        }

        attackTimer = Math.max(0f, attackTimer - dt);

        acquireTarget(allUnits, playerBase, enemyBase);

        if (target != null) {
            if (attackTimer <= 0f) {
                performAttack(allUnits);
                attackTimer = type.attackCooldown();
            }
            if (target.isDead()) target = null;
        } else {
            float dir = enemy ? 1f : -1f;
            y += dir * type.speed * dt;
        }
    }

    // ── Attack logic ──────────────────────────────────────────────────────────
    private void performAttack(List<Unit> allUnits) {
        switch (type.ability) {
            case AOE_FIRE:
            case AOE_BOMB:
                // Damage all hostile units in AoE radius around the primary target
                float aoeR = type.aoeRadius();
                float cx   = target.getX();
                float cy   = target.getY();
                for (Unit u : allUnits) {
                    if (u.isDead() || u.isEnemy() == this.enemy) continue;
                    float dx = u.getX() - cx;
                    float dy = u.getY() - cy;
                    if (Math.sqrt(dx * dx + dy * dy) <= aoeR) {
                        u.takeDamage(type.damage);
                    }
                }
                // Also hit the base if it's the target
                if (!(target instanceof Unit)) {
                    target.takeDamage(type.damage);
                }
                break;

            case FREEZE:
                // Deal damage then freeze
                target.takeDamage(type.damage);
                if (target instanceof Unit) {
                    ((Unit) target).applyFreeze(type.freezeDuration());
                }
                break;

            default:
                target.takeDamage(type.damage);
                break;
        }
    }

    // ── Target acquisition ────────────────────────────────────────────────────
    private void acquireTarget(List<Unit> allUnits,
                               MainBase playerBase,
                               MainBase enemyBase) {
        if (target != null && !target.isDead()) {
            if (distanceTo(target) <= type.range) return;
            else target = null;
        }

        IDamageable closest    = null;
        float       closestDist = Float.MAX_VALUE;

        for (Unit u : allUnits) {
            if (u == this || u.isDead() || u.isEnemy() == this.enemy) continue;
            float d = distanceTo(u);
            if (d <= type.range && d < closestDist) {
                closestDist = d;
                closest     = u;
            }
        }

        MainBase targetBase = enemy ? playerBase : enemyBase;
        float baseDist = distanceTo(targetBase);
        if (baseDist <= type.range && baseDist < closestDist) {
            closest = targetBase;
        }

        target = closest;
    }

    private float distanceTo(IDamageable other) {
        float dx = other.getX() - x;
        float dy = other.getY() - y;
        return (float) Math.sqrt(dx * dx + dy * dy);
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    public void draw(Canvas canvas) {
        if (dead) return;

        float hw     = type.halfW();
        float hh     = type.halfH();
        float radius = hw * 0.35f;

        // Body colour — special tints for new units
        int fillColor = getBodyColor();
        BODY_PAINT.setColor(fillColor);
        RectF body = new RectF(x - hw, y - hh, x + hw, y + hh);
        canvas.drawRoundRect(body, radius, radius, BODY_PAINT);

        // Freeze overlay
        if (freezeTimer > 0f) {
            canvas.drawRoundRect(body, radius, radius, FREEZE_PAINT);
        }

        // Outline
        OUTLINE_PAINT.setColor(getOutlineColor());
        canvas.drawRoundRect(body, radius, radius, OUTLINE_PAINT);

        // AoE ring (Dragon / Bombardier) — subtle indicator when attacking
        if (target != null && (type.ability == UnitType.SpecialAbility.AOE_FIRE
                            || type.ability == UnitType.SpecialAbility.AOE_BOMB)) {
            AOE_PAINT.setColor(type.ability == UnitType.SpecialAbility.AOE_FIRE
                    ? Color.argb(80, 255, 140, 0)
                    : Color.argb(80, 255, 220, 0));
            canvas.drawCircle(x, y, type.aoeRadius(), AOE_PAINT);
        }

        // Emoji icon
        ICON_PAINT.setTextSize(hw * 1.1f);
        ICON_PAINT.setColor(freezeTimer > 0f ? Color.argb(180, 200, 240, 255) : Color.WHITE);
        canvas.drawText(type.icon, x, y + ICON_PAINT.getTextSize() * 0.35f, ICON_PAINT);

        // HP bar
        drawHpBar(canvas, hw, hh);

        // Freeze indicator text
        if (freezeTimer > 0f) {
            ICON_PAINT.setTextSize(hw * 0.55f);
            ICON_PAINT.setColor(Color.rgb(100, 200, 255));
            canvas.drawText("❄️", x, y - hh - 14f, ICON_PAINT);
        }
    }

    private int getBodyColor() {
        if (enemy) {
            switch (type) {
                case DRAGON:     return Color.argb(220, 180, 40,  40);
                case BOMBARDIER: return Color.argb(220, 160, 80,  20);
                case MAGE:       return Color.argb(220, 130, 20, 180);
                default:         return Color.argb(220, 210, 50,  50);
            }
        } else {
            switch (type) {
                case DRAGON:     return Color.argb(220, 180, 80,  20);
                case BOMBARDIER: return Color.argb(220, 120, 100, 20);
                case MAGE:       return Color.argb(220, 80,  20, 180);
                default:         return Color.argb(220, 50, 120, 220);
            }
        }
    }

    private int getOutlineColor() {
        if (freezeTimer > 0f) return Color.argb(255, 140, 220, 255);
        if (enemy) {
            switch (type) {
                case DRAGON:     return Color.argb(255, 255, 120,  80);
                case MAGE:       return Color.argb(255, 200, 100, 255);
                default:         return Color.argb(255, 255, 120, 120);
            }
        } else {
            switch (type) {
                case DRAGON:     return Color.argb(255, 255, 160,  80);
                case MAGE:       return Color.argb(255, 160, 100, 255);
                default:         return Color.argb(255, 140, 200, 255);
            }
        }
    }

    private void drawHpBar(Canvas canvas, float hw, float hh) {
        float barW = hw * 2f;
        float barH = 6f;
        float bx   = x - hw;
        float by   = y - hh - 10f;

        canvas.drawRoundRect(bx, by, bx + barW, by + barH, 3f, 3f, HP_BG_PAINT);

        float pct = (float) hp / type.maxHp;
        if (pct > 0.5f)      HP_FG_PAINT.setColor(Color.rgb(60,  200,  60));
        else if (pct > 0.2f) HP_FG_PAINT.setColor(Color.rgb(240, 200,  40));
        else                 HP_FG_PAINT.setColor(Color.rgb(220,  50,  50));

        canvas.drawRoundRect(bx, by, bx + barW * pct, by + barH, 3f, 3f, HP_FG_PAINT);
    }
}
