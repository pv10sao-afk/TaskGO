package com.cardtowerdefense;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Main game SurfaceView.
 *
 * Responsibilities
 * ────────────────
 *   • Owns and drives the game loop thread (~60 FPS).
 *   • Manages elixir, units, bases, deck, and waves.
 *   • Handles tap-tap and drag deployment input.
 *   • Renders everything via Canvas.
 */
@SuppressLint("ViewConstructor")
public class GameView extends SurfaceView implements SurfaceHolder.Callback {

    // ═════════════════════════════════════════════════════════════════════════
    //  Constants
    // ═════════════════════════════════════════════════════════════════════════

    private static final int   LANE_COUNT       = 6;
    private static final float MAX_ELIXIR        = 10f;
    private static final float START_ELIXIR      = 5f;
    private static final float ELIXIR_BASE_REGEN = 1.0f;    // per second
    private static final long  TARGET_FRAME_MS   = 16L;      // ~62.5 FPS

    // ─── HUD geometry (fraction of screen height) ─────────────────────────────
    private static final float HUD_HEIGHT_FRAC  = 0.22f;    // bottom HUD strip
    private static final float BASE_HEIGHT_FRAC = 0.07f;    // each base

    // ═════════════════════════════════════════════════════════════════════════
    //  Dimensions (set after surfaceCreated)
    // ═════════════════════════════════════════════════════════════════════════

    private float screenW, screenH;
    private float hudH;         // pixel height of bottom HUD strip
    private float laneW;        // pixel width of each lane
    private float playfieldTop; // Y of enemy base bottom
    private float playfieldBot; // Y of player base top
    private float midY;         // Y centre of playfield

    // Card slot geometry
    private RectF[] cardSlotRects  = new RectF[5];
    private RectF   nextCardRect;

    // ═════════════════════════════════════════════════════════════════════════
    //  Game state
    // ═════════════════════════════════════════════════════════════════════════

    private float elixir = START_ELIXIR;
    private int   killCount = 0;

    private final List<Unit> units = new ArrayList<>();

    private MainBase playerBase;
    private MainBase enemyBase;
    private DeckManager  deckManager;
    private WaveManager  waveManager;

    // ─── Game outcome ─────────────────────────────────────────────────────────
    private enum GameState { PLAYING, VICTORY, DEFEAT }
    private GameState gameState = GameState.PLAYING;

    // ═════════════════════════════════════════════════════════════════════════
    //  Input state
    // ═════════════════════════════════════════════════════════════════════════

    // Tap-Tap: first tap selects a card slot index (-1 = none)
    private int selectedCardSlot = -1;

    // Drag: started from a card slot
    private boolean dragActive   = false;
    private int     dragSlot     = -1;
    private float   dragX, dragY;   // current finger position

    // Ghost card animation
    private boolean showGhost      = false;
    private float   ghostX, ghostY;
    private int     ghostLane      = -1;   // -1 = free-moving (Fireball)
    private UnitType ghostType;

    // ═════════════════════════════════════════════════════════════════════════
    //  Paints
    // ═════════════════════════════════════════════════════════════════════════

    // Reuse paint objects to avoid allocations in the render loop.
    private final Paint bgPaint         = new Paint();
    private final Paint lanePaint       = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hudBgPaint      = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cardBgPaint     = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cardSelPaint    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint cardTextPaint   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint elixirBgPaint   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint elixirFgPaint   = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint elixirTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ghostPaint      = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint overlayPaint    = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint overlayTextPaint= new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hudInfoPaint    = new Paint(Paint.ANTI_ALIAS_FLAG);

    // ═════════════════════════════════════════════════════════════════════════
    //  Game loop thread
    // ═════════════════════════════════════════════════════════════════════════

    private Thread gameThread;
    private volatile boolean running = false;

    // ═════════════════════════════════════════════════════════════════════════
    //  Constructor
    // ═════════════════════════════════════════════════════════════════════════

    public GameView(Context context) {
        super(context);
        getHolder().addCallback(this);
        setFocusable(true);
        initPaints();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  SurfaceHolder.Callback
    // ═════════════════════════════════════════════════════════════════════════

    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        // Dimensions may not be available yet; grab them safely
        if (getWidth() > 0 && getHeight() > 0) initGame();
    }

    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
        screenW = width;
        screenH = height;
        if (playerBase == null) initGame();   // first valid dimensions
        startLoop();
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        stopLoop();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Initialisation
    // ═════════════════════════════════════════════════════════════════════════

    private void initGame() {
        screenW = getWidth();
        screenH = getHeight();

        hudH        = screenH * HUD_HEIGHT_FRAC;
        laneW       = screenW / LANE_COUNT;
        float baseH = screenH * BASE_HEIGHT_FRAC;

        playfieldTop = baseH;                       // just below enemy base
        playfieldBot = screenH - hudH - baseH;      // just above player base
        midY         = (playfieldTop + playfieldBot) * 0.5f;

        playerBase  = new MainBase(false, screenW, screenH);
        enemyBase   = new MainBase(true,  screenW, screenH);
        deckManager = new DeckManager();
        waveManager = new WaveManager(units, screenW, LANE_COUNT, playfieldTop + 4f);

        buildCardSlotRects();
    }

    private void buildCardSlotRects() {
        float slotW   = screenW * 0.17f;
        float slotH   = hudH   * 0.52f;
        float spacing = (screenW - slotW * 5) / 6f;
        float topY    = screenH - hudH + hudH * 0.30f;

        cardSlotRects = new RectF[5];
        for (int i = 0; i < 5; i++) {
            float left = spacing + i * (slotW + spacing);
            cardSlotRects[i] = new RectF(left, topY, left + slotW, topY + slotH);
        }

        // "Next" preview: small box above slot 0
        RectF s0 = cardSlotRects[0];
        float nw = s0.width() * 0.65f;
        float nh = s0.height() * 0.50f;
        nextCardRect = new RectF(s0.left, s0.top - nh - 8f, s0.left + nw, s0.top - 8f);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Game loop
    // ═════════════════════════════════════════════════════════════════════════

    private void startLoop() {
        if (running) return;
        running    = true;
        gameThread = new Thread(this::loopBody, "GameLoop");
        gameThread.start();
    }

    private void stopLoop() {
        running = false;
        try { if (gameThread != null) gameThread.join(200); } catch (InterruptedException ignored) {}
    }

    private void loopBody() {
        long prevNano = System.nanoTime();

        while (running) {
            long now   = System.nanoTime();
            float dt   = (now - prevNano) / 1_000_000_000f;
            dt         = Math.min(dt, 0.05f);   // clamp to avoid spiral of death
            prevNano   = now;

            if (gameState == GameState.PLAYING) {
                update(dt);
            }

            Canvas canvas = getHolder().lockCanvas();
            if (canvas != null) {
                try { render(canvas); }
                finally { getHolder().unlockCanvasAndPost(canvas); }
            }

            // Sleep to target ~60 FPS
            long elapsed = (System.nanoTime() - now) / 1_000_000;
            long sleep   = TARGET_FRAME_MS - elapsed;
            if (sleep > 0) { try { Thread.sleep(sleep); } catch (InterruptedException ignored) {} }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Update phases
    // ═════════════════════════════════════════════════════════════════════════

    private void update(float dt) {
        // 1. Elixir regen
        float regen = ELIXIR_BASE_REGEN * waveManager.getElixirRegenMultiplier();
        elixir = Math.min(MAX_ELIXIR, elixir + regen * dt);

        // 2. Wave manager tick
        waveManager.update(dt);

        // 3. Base auto-fire
        playerBase.update(dt, units);
        enemyBase.update(dt, units);

        // 4–5. Unit update (target acquisition + movement + combat)
        for (Unit u : units) {
            u.update(dt, units, playerBase, enemyBase, screenH);
        }

        // 6. Dead unit cleanup
        int before = units.size();
        Iterator<Unit> it = units.iterator();
        while (it.hasNext()) {
            Unit u = it.next();
            if (u.isDead()) {
                it.remove();
                if (u.isEnemy()) killCount++;
            }
        }

        // 7. Win / loss check
        if (enemyBase.isDead()) gameState = GameState.VICTORY;
        else if (playerBase.isDead()) gameState = GameState.DEFEAT;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Rendering
    // ═════════════════════════════════════════════════════════════════════════

    private void render(Canvas canvas) {
        // Background
        canvas.drawColor(Color.rgb(15, 20, 35));

        // Lane dividers
        drawLanes(canvas);

        // Bases
        enemyBase.draw(canvas);
        playerBase.draw(canvas);

        // Units
        for (Unit u : units) u.draw(canvas);

        // Ghost preview
        if (showGhost && ghostType != null) drawGhost(canvas);

        // HUD
        drawHud(canvas);

        // Game-over overlay
        if (gameState != GameState.PLAYING) drawGameOverOverlay(canvas);
    }

    // ─── Lanes ────────────────────────────────────────────────────────────────
    private void drawLanes(Canvas canvas) {
        // Alternate lane tint
        lanePaint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < LANE_COUNT; i++) {
            float left = i * laneW;
            lanePaint.setColor(i % 2 == 0
                    ? Color.argb(30, 255, 255, 255)
                    : Color.argb(10, 255, 255, 255));
            canvas.drawRect(left, playfieldTop, left + laneW, playfieldBot, lanePaint);
        }
        // Dividers
        lanePaint.setColor(Color.argb(60, 200, 200, 255));
        lanePaint.setStyle(Paint.Style.STROKE);
        lanePaint.setStrokeWidth(1.5f);
        for (int i = 1; i < LANE_COUNT; i++) {
            float x = i * laneW;
            canvas.drawLine(x, 0, x, screenH - hudH, lanePaint);
        }
        // Player-deployment zone marker (bottom half of playfield)
        lanePaint.setColor(Color.argb(25, 100, 200, 255));
        lanePaint.setStyle(Paint.Style.FILL);
        canvas.drawRect(0, midY, screenW, playfieldBot, lanePaint);
    }

    // ─── Ghost preview ────────────────────────────────────────────────────────
    private void drawGhost(Canvas canvas) {
        ghostPaint.setStyle(Paint.Style.FILL);

        if (ghostType == UnitType.FIREBALL) {
            // Free-moving AoE circle
            ghostPaint.setColor(Color.argb(100, 255, 120, 0));
            canvas.drawCircle(ghostX, ghostY, UnitType.FIREBALL.range, ghostPaint);
            ghostPaint.setStyle(Paint.Style.STROKE);
            ghostPaint.setStrokeWidth(3f);
            ghostPaint.setColor(Color.argb(200, 255, 200, 0));
            canvas.drawCircle(ghostX, ghostY, UnitType.FIREBALL.range, ghostPaint);
        } else {
            float hw = ghostType.halfW();
            float hh = ghostType.halfH();
            float cx = (ghostLane >= 0) ? ghostLane * laneW + laneW * 0.5f : ghostX;
            ghostPaint.setColor(Color.argb(100, 100, 180, 255));
            canvas.drawRoundRect(cx - hw, ghostY - hh, cx + hw, ghostY + hh,
                    hw * 0.3f, hw * 0.3f, ghostPaint);
            // Icon
            cardTextPaint.setTextSize(hw * 1.1f);
            cardTextPaint.setColor(Color.argb(200, 255, 255, 255));
            canvas.drawText(ghostType.icon, cx, ghostY + cardTextPaint.getTextSize() * 0.35f, cardTextPaint);
        }
    }

    // ─── HUD ──────────────────────────────────────────────────────────────────
    private void drawHud(Canvas canvas) {
        // HUD background
        hudBgPaint.setColor(Color.argb(220, 10, 14, 28));
        canvas.drawRect(0, screenH - hudH, screenW, screenH, hudBgPaint);

        // Top separator line
        hudBgPaint.setColor(Color.argb(120, 80, 120, 220));
        canvas.drawRect(0, screenH - hudH, screenW, screenH - hudH + 2f, hudBgPaint);

        // Elixir bar
        drawElixirBar(canvas);

        // Card slots
        for (int i = 0; i < 5; i++) drawCardSlot(canvas, i);

        // "Next" card preview
        drawNextCard(canvas);

        // Kill counter + wave info (top-right)
        drawHudInfo(canvas);
    }

    private void drawElixirBar(Canvas canvas) {
        float barH  = hudH * 0.10f;
        float barW  = screenW * 0.80f;
        float bx    = (screenW - barW) * 0.5f;
        float by    = screenH - hudH + hudH * 0.08f;

        // BG
        elixirBgPaint.setColor(Color.argb(150, 30, 10, 60));
        canvas.drawRoundRect(bx, by, bx + barW, by + barH, barH * 0.5f, barH * 0.5f, elixirBgPaint);

        // FG – purple gradient segment per elixir unit
        float pct = elixir / MAX_ELIXIR;
        elixirFgPaint.setColor(Color.rgb(160, 60, 230));
        canvas.drawRoundRect(bx, by, bx + barW * pct, by + barH, barH * 0.5f, barH * 0.5f, elixirFgPaint);

        // Pip dividers
        elixirBgPaint.setColor(Color.argb(100, 255, 255, 255));
        elixirBgPaint.setStyle(Paint.Style.STROKE);
        elixirBgPaint.setStrokeWidth(1.5f);
        for (int i = 1; i < (int) MAX_ELIXIR; i++) {
            float px = bx + barW * (i / MAX_ELIXIR);
            canvas.drawLine(px, by, px, by + barH, elixirBgPaint);
        }
        elixirBgPaint.setStyle(Paint.Style.FILL);

        // Text
        elixirTextPaint.setColor(Color.WHITE);
        elixirTextPaint.setTextSize(barH * 0.90f);
        elixirTextPaint.setTextAlign(Paint.Align.CENTER);
        String txt = String.format("%.1f / %.0f", elixir, MAX_ELIXIR);
        canvas.drawText(txt, screenW * 0.5f, by + barH - 1f, elixirTextPaint);
    }

    private void drawCardSlot(Canvas canvas, int i) {
        RectF r = cardSlotRects[i];
        UnitType card = deckManager.getCard(i);
        boolean selected = (selectedCardSlot == i);
        boolean affordable = card != null && elixir >= card.elixirCost;

        // Slot background
        cardBgPaint.setColor(selected
                ? Color.argb(230, 50, 110, 230)
                : affordable
                        ? Color.argb(200, 30, 45, 90)
                        : Color.argb(140, 15, 20, 45));
        canvas.drawRoundRect(r, 12f, 12f, cardBgPaint);

        // Selection outline
        if (selected) {
            cardSelPaint.setStyle(Paint.Style.STROKE);
            cardSelPaint.setStrokeWidth(3f);
            cardSelPaint.setColor(Color.rgb(120, 200, 255));
            canvas.drawRoundRect(r, 12f, 12f, cardSelPaint);
        }

        if (card == null) return;

        float cx = r.centerX();

        // Emoji icon
        cardTextPaint.setTextSize(r.height() * 0.42f);
        cardTextPaint.setColor(affordable ? Color.WHITE : Color.argb(140, 200, 200, 200));
        cardTextPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(card.icon, cx, r.top + r.height() * 0.50f, cardTextPaint);

        // Name
        cardTextPaint.setTextSize(r.height() * 0.18f);
        cardTextPaint.setColor(Color.argb(210, 200, 220, 255));
        canvas.drawText(card.name, cx, r.top + r.height() * 0.72f, cardTextPaint);

        // Cost badge
        float badgeR = r.height() * 0.18f;
        float badgeX = r.right  - badgeR - 4f;
        float badgeY = r.bottom - badgeR - 4f;
        cardBgPaint.setColor(affordable ? Color.rgb(160, 60, 230) : Color.argb(150, 80, 30, 110));
        canvas.drawCircle(badgeX, badgeY, badgeR, cardBgPaint);
        cardTextPaint.setTextSize(badgeR * 1.1f);
        cardTextPaint.setColor(Color.WHITE);
        canvas.drawText(String.valueOf(card.elixirCost), badgeX, badgeY + badgeR * 0.38f, cardTextPaint);
    }

    private void drawNextCard(Canvas canvas) {
        UnitType next = deckManager.peekNext();
        if (next == null || nextCardRect == null) return;

        RectF r = nextCardRect;
        cardBgPaint.setColor(Color.argb(160, 20, 30, 70));
        canvas.drawRoundRect(r, 8f, 8f, cardBgPaint);

        cardTextPaint.setTextSize(r.height() * 0.55f);
        cardTextPaint.setColor(Color.WHITE);
        cardTextPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(next.icon, r.centerX(), r.centerY() + cardTextPaint.getTextSize() * 0.35f, cardTextPaint);

        // "NEXT" label
        cardTextPaint.setTextSize(r.height() * 0.25f);
        cardTextPaint.setColor(Color.argb(180, 160, 180, 255));
        canvas.drawText("NEXT", r.centerX(), r.top - 4f, cardTextPaint);
    }

    private void drawHudInfo(Canvas canvas) {
        hudInfoPaint.setColor(Color.argb(200, 200, 220, 255));
        hudInfoPaint.setTextSize(screenH * 0.020f);
        hudInfoPaint.setTextAlign(Paint.Align.RIGHT);
        hudInfoPaint.setTypeface(Typeface.DEFAULT_BOLD);

        float rx = screenW - 16f;
        float ty = screenH * 0.04f;

        canvas.drawText("Kills: " + killCount, rx, ty, hudInfoPaint);
        canvas.drawText("Wave:  " + waveManager.getWaveNumber(), rx, ty + hudInfoPaint.getTextSize() * 1.4f, hudInfoPaint);
        if (waveManager.isSuddenDeath()) {
            hudInfoPaint.setColor(Color.rgb(255, 60, 60));
            canvas.drawText("⚠ SUDDEN DEATH", rx, ty + hudInfoPaint.getTextSize() * 2.8f, hudInfoPaint);
        }
    }

    // ─── Game-over overlay ────────────────────────────────────────────────────
    private void drawGameOverOverlay(Canvas canvas) {
        overlayPaint.setColor(Color.argb(170, 5, 5, 15));
        canvas.drawRect(0, 0, screenW, screenH, overlayPaint);

        boolean victory = (gameState == GameState.VICTORY);
        overlayTextPaint.setTextAlign(Paint.Align.CENTER);
        overlayTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
        overlayTextPaint.setColor(victory ? Color.rgb(80, 230, 120) : Color.rgb(230, 60, 60));
        overlayTextPaint.setTextSize(screenH * 0.10f);
        canvas.drawText(victory ? "VICTORY!" : "DEFEAT", screenW * 0.5f, screenH * 0.38f, overlayTextPaint);

        overlayTextPaint.setColor(Color.argb(200, 200, 220, 255));
        overlayTextPaint.setTextSize(screenH * 0.035f);
        canvas.drawText("Kills: " + killCount, screenW * 0.5f, screenH * 0.50f, overlayTextPaint);
        canvas.drawText("Tap to restart", screenW * 0.5f, screenH * 0.58f, overlayTextPaint);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Input handling
    // ═════════════════════════════════════════════════════════════════════════

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (playerBase == null) return true;

        float tx = event.getX();
        float ty = event.getY();

        // Restart on game-over tap
        if (gameState != GameState.PLAYING) {
            if (event.getAction() == MotionEvent.ACTION_UP) restartGame();
            return true;
        }

        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                handleDown(tx, ty);
                break;
            case MotionEvent.ACTION_MOVE:
                handleMove(tx, ty);
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                handleUp(tx, ty);
                break;
        }
        return true;
    }

    private void handleDown(float tx, float ty) {
        int slot = cardSlotHit(tx, ty);
        if (slot >= 0) {
            dragSlot   = slot;
            dragActive = false;   // not yet dragging (need some movement)
            dragX      = tx;
            dragY      = ty;
            selectedCardSlot = slot;   // also register as tap-tap selection
        }
    }

    private void handleMove(float tx, float ty) {
        if (dragSlot < 0) return;

        float dx = tx - dragX;
        float dy = ty - dragY;
        if (!dragActive && Math.sqrt(dx * dx + dy * dy) > 20f) {
            dragActive = true;
        }

        if (dragActive) {
            UnitType card = deckManager.getCard(dragSlot);
            ghostType = card;
            ghostX    = tx;
            ghostY    = ty;
            showGhost = (ty < screenH - hudH);   // only show in playfield

            if (card == UnitType.FIREBALL) {
                ghostLane = -1;   // free-moving
            } else {
                ghostLane = laneAt(tx);
            }
        }
    }

    private void handleUp(float tx, float ty) {
        if (dragActive) {
            // Drag-drop deploy
            if (ty < screenH - hudH) {
                UnitType card = deckManager.getCard(dragSlot);
                tryDeployFromSlot(dragSlot, card, tx, ty);
            }
        } else if (dragSlot >= 0) {
            // Tap-tap: check if finger released in playfield
            if (ty < screenH - hudH && selectedCardSlot >= 0) {
                UnitType card = deckManager.getCard(selectedCardSlot);
                tryDeployFromSlot(selectedCardSlot, card, tx, ty);
                selectedCardSlot = -1;
            } else if (ty >= screenH - hudH) {
                // Tapped HUD area – slot already selected via handleDown, keep it
            }
        }

        // Tap-tap second tap in playfield: handled above; deselect if tapped HUD
        // but we keep selectedCardSlot logic minimal here.

        showGhost  = false;
        dragActive = false;
        dragSlot   = -1;
    }

    // ── Deploy logic ──────────────────────────────────────────────────────────

    private void tryDeployFromSlot(int slot, UnitType card, float tx, float ty) {
        if (card == null) return;
        if (elixir < card.elixirCost) return;

        if (card == UnitType.FIREBALL) {
            // Spell: apply AoE instantly
            if (!isInDeployZone(tx, ty) && ty < screenH - hudH) {
                applyFireball(tx, ty);
                elixir -= card.elixirCost;
                deckManager.playCard(slot);
            }
        } else {
            // Unit: must deploy in player bottom half
            if (isInDeployZone(tx, ty)) {
                int lane = laneAt(tx);
                float cx = lane * laneW + laneW * 0.5f;
                float cy = midY + (playfieldBot - midY) * 0.5f;
                units.add(new Unit(card, false, cx, cy));
                elixir -= card.elixirCost;
                deckManager.playCard(slot);
                selectedCardSlot = -1;
            }
        }
    }

    /** Player units must be placed in the bottom half of the playfield. */
    private boolean isInDeployZone(float tx, float ty) {
        return tx >= 0 && tx < screenW && ty >= midY && ty < playfieldBot;
    }

    private void applyFireball(float fx, float fy) {
        float radius = UnitType.FIREBALL.range;
        for (Unit u : units) {
            if (u.isDead()) continue;
            float dx = u.getX() - fx;
            float dy = u.getY() - fy;
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                u.takeDamage(UnitType.FIREBALL.damage);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Returns the 0-based lane index for screen X coordinate. */
    private int laneAt(float x) {
        return (int) Math.max(0, Math.min(LANE_COUNT - 1, x / laneW));
    }

    /** Returns card slot index (0–4) if tx,ty hits a slot rectangle, else -1. */
    private int cardSlotHit(float tx, float ty) {
        for (int i = 0; i < 5; i++) {
            if (cardSlotRects[i] != null && cardSlotRects[i].contains(tx, ty)) return i;
        }
        return -1;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Restart
    // ═════════════════════════════════════════════════════════════════════════

    // ═════════════════════════════════════════════════════════════════════════
    //  Lifecycle
    // ═════════════════════════════════════════════════════════════════════════

    public void onPause() { stopLoop(); }
    public void onResume() { if (getHolder().getSurface().isValid()) startLoop(); }

    private void restartGame() {
        elixir           = START_ELIXIR;
        killCount        = 0;
        selectedCardSlot = -1;
        dragActive       = false;
        showGhost        = false;
        units.clear();
        initGame();
        gameState = GameState.PLAYING;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Paint initialisation
    // ═════════════════════════════════════════════════════════════════════════

    private void initPaints() {
        bgPaint.setColor(Color.rgb(15, 20, 35));

        lanePaint.setStyle(Paint.Style.FILL);

        hudBgPaint.setStyle(Paint.Style.FILL);

        cardBgPaint.setStyle(Paint.Style.FILL);
        cardSelPaint.setStyle(Paint.Style.STROKE);

        cardTextPaint.setTextAlign(Paint.Align.CENTER);
        cardTextPaint.setTypeface(Typeface.DEFAULT_BOLD);

        ghostPaint.setStyle(Paint.Style.FILL);

        overlayPaint.setStyle(Paint.Style.FILL);
        overlayTextPaint.setTextAlign(Paint.Align.CENTER);
        overlayTextPaint.setTypeface(Typeface.DEFAULT_BOLD);

        hudInfoPaint.setTextAlign(Paint.Align.RIGHT);
        hudInfoPaint.setTypeface(Typeface.DEFAULT_BOLD);

        elixirBgPaint.setStyle(Paint.Style.FILL);
        elixirTextPaint.setTextAlign(Paint.Align.CENTER);
        elixirTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
    }
}
