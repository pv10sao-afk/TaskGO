package com.cardtowerdefense;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;

import java.util.List;

/**
 * Represents either the Player base (bottom) or Enemy base (top).
 * Auto-fires at the nearest hostile unit within 200 px every 1 second.
 */
public class MainBase implements IDamageable {

    // ── Constants ─────────────────────────────────────────────────────────────
    private static final float AUTO_FIRE_RANGE    = 200f;
    private static final int   AUTO_FIRE_DAMAGE   = 8;
    private static final float AUTO_FIRE_COOLDOWN = 1.0f;   // seconds
    private static final int   MAX_HP             = 1000;

    // ── Identity ─────────────────────────────────────────────────────────────
    private final boolean enemy;   // true → enemy base (top)

    // ── Geometry ─────────────────────────────────────────────────────────────
    private final RectF rect;

    // ── Stats ─────────────────────────────────────────────────────────────────
    private int   hp = MAX_HP;
    private float fireTimer;

    // ── Paints ───────────────────────────────────────────────────────────────
    private static final Paint FILL_PAINT    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint OUTLINE_PAINT = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint TEXT_PAINT    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint HP_BG_PAINT   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private static final Paint HP_FG_PAINT   = new Paint(Paint.ANTI_ALIAS_FLAG);

    static {
        OUTLINE_PAINT.setStyle(Paint.Style.STROKE);
        OUTLINE_PAINT.setStrokeWidth(3f);

        TEXT_PAINT.setTextAlign(Paint.Align.CENTER);
        TEXT_PAINT.setTypeface(Typeface.DEFAULT_BOLD);
        TEXT_PAINT.setColor(Color.WHITE);

        HP_BG_PAINT.setColor(Color.argb(180, 20, 20, 20));
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    public MainBase(boolean enemy, float screenW, float screenH) {
        this.enemy = enemy;
        float h = screenH * 0.07f;   // 7% of screen height
        if (enemy) {
            rect = new RectF(0, 0, screenW, h);
        } else {
            // Sits above the HUD strip; GameView reserves ~160dp at bottom for HUD
            float hudH  = screenH * 0.22f;
            rect = new RectF(0, screenH - hudH - h, screenW, screenH - hudH);
        }
    }

    // ── IDamageable ───────────────────────────────────────────────────────────
    @Override public void    takeDamage(int amount) { hp = Math.max(0, hp - amount); }
    @Override public boolean isDead()   { return hp <= 0; }
    @Override public float   getX()     { return rect.centerX(); }
    @Override public float   getY()     { return rect.centerY(); }
    @Override public boolean isEnemy()  { return enemy; }

    // ── Accessors ─────────────────────────────────────────────────────────────
    public int   getHp()     { return hp; }
    public int   getMaxHp()  { return MAX_HP; }
    public RectF getRect()   { return rect; }
    /** Y coordinate that units attack towards (top edge for player base, bottom edge for enemy base). */
    public float getAttackY() { return enemy ? rect.bottom : rect.top; }

    // ── Update ────────────────────────────────────────────────────────────────
    public void update(float dt, List<Unit> allUnits) {
        if (isDead()) return;

        fireTimer = Math.max(0f, fireTimer - dt);
        if (fireTimer > 0f) return;

        // Find nearest hostile unit within range
        Unit nearest = null;
        float nearestDist = AUTO_FIRE_RANGE;

        for (Unit u : allUnits) {
            if (u.isDead() || u.isEnemy() == this.enemy) continue;
            float dx = u.getX() - getX();
            float dy = u.getY() - getY();
            float d  = (float) Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) {
                nearestDist = d;
                nearest     = u;
            }
        }

        if (nearest != null) {
            nearest.takeDamage(AUTO_FIRE_DAMAGE);
            fireTimer = AUTO_FIRE_COOLDOWN;
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    public void draw(Canvas canvas) {
        // Body
        FILL_PAINT.setColor(enemy
                ? Color.argb(230, 160, 30,  30)
                : Color.argb(230, 30,  80, 180));
        canvas.drawRoundRect(rect, 10f, 10f, FILL_PAINT);

        OUTLINE_PAINT.setColor(enemy
                ? Color.rgb(255, 100, 100)
                : Color.rgb(100, 160, 255));
        canvas.drawRoundRect(rect, 10f, 10f, OUTLINE_PAINT);

        // Label
        float cx = rect.centerX();
        float cy = rect.centerY();
        TEXT_PAINT.setTextSize(rect.height() * 0.38f);
        canvas.drawText(enemy ? "ENEMY BASE" : "PLAYER BASE", cx, cy - rect.height() * 0.06f, TEXT_PAINT);

        // HP bar
        float pct  = (float) hp / MAX_HP;
        float barW = rect.width() * 0.6f;
        float barH = rect.height() * 0.18f;
        float bx   = cx - barW * 0.5f;
        float by   = cy + rect.height() * 0.12f;

        canvas.drawRoundRect(bx, by, bx + barW, by + barH, 4f, 4f, HP_BG_PAINT);
        if (pct > 0.5f)       HP_FG_PAINT.setColor(Color.rgb(60,  200, 60));
        else if (pct > 0.2f)  HP_FG_PAINT.setColor(Color.rgb(240, 200, 40));
        else                  HP_FG_PAINT.setColor(Color.rgb(220,  50, 50));
        canvas.drawRoundRect(bx, by, bx + barW * pct, by + barH, 4f, 4f, HP_FG_PAINT);

        // HP text
        TEXT_PAINT.setTextSize(barH * 0.85f);
        canvas.drawText(hp + " / " + MAX_HP, cx, by + barH - 1f, TEXT_PAINT);
    }
}
