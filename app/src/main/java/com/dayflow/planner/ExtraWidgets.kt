package com.dayflow.planner

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.dayflow.planner.data.PlannerStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.Calendar

/** 2×2 mini widget — shows task count only */
class MiniWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> updateMini(context, manager, id) }
    }

    companion object {
        fun updateMini(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_mini)
            val tap = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(android.R.id.content, tap)

            CoroutineScope(Dispatchers.IO).launch {
                val state = PlannerStore(context.applicationContext).appState.first()
                val today = Calendar.getInstance()
                val pending = state.tasks.count { task ->
                    !task.completed && (task.deadlineMillis == null || run {
                        val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
                        tc.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR) &&
                        tc.get(Calendar.YEAR) == today.get(Calendar.YEAR)
                    })
                }
                views.setTextViewText(R.id.widget_mini_count, pending.toString())
                manager.updateAppWidget(id, views)
            }
        }
    }
}

/** 4×2 focus timer widget — shows remaining focus time */
class FocusWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> updateFocus(context, manager, id) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.dayflow.planner.ACTION_FOCUS_TOGGLE") {
            CoroutineScope(Dispatchers.IO).launch {
                val store = PlannerStore(context.applicationContext)
                val state = store.appState.first()
                val timer = state.focusTimer
                val now = System.currentTimeMillis()
                
                if (timer.remainingAt(now) <= 0) {
                    store.completeTimerSession()
                } else if (timer.isRunning) {
                    store.pauseTimer(now)
                } else {
                    store.startTimer(now)
                }
            }
        }
    }

    companion object {
        fun updateFocus(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_focus)
            val tap = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(android.R.id.content, tap)

            val toggleIntent = Intent(context, FocusWidget::class.java).apply {
                action = "com.dayflow.planner.ACTION_FOCUS_TOGGLE"
            }
            val toggleTap = PendingIntent.getBroadcast(
                context, 0, toggleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_focus_btn_toggle, toggleTap)

            CoroutineScope(Dispatchers.IO).launch {
                val state = PlannerStore(context.applicationContext).appState.first()
                val timer = state.focusTimer
                val nowMillis = System.currentTimeMillis()
                val remaining = timer.remainingAt(nowMillis)

                val totalSec = (remaining / 1000L).coerceAtLeast(0L)
                val m = totalSec / 60
                val s = totalSec % 60
                val label = "%02d:%02d".format(m, s)
                val status = when {
                    timer.isRunning -> "🟢 Таймер працює · ${timer.durationMinutes} хв"
                    remaining > 0   -> "⏸ Пауза · ${timer.durationMinutes} хв"
                    else            -> "Таймер не запущений"
                }

                if (timer.isRunning) {
                    views.setImageViewResource(R.id.widget_focus_btn_toggle, android.R.drawable.ic_media_pause)
                    val baseMillis = android.os.SystemClock.elapsedRealtime() + remaining
                    views.setChronometer(R.id.widget_focus_time_chronometer, baseMillis, "%s", true)
                    views.setViewVisibility(R.id.widget_focus_time_chronometer, android.view.View.VISIBLE)
                    views.setViewVisibility(R.id.widget_focus_time_text, android.view.View.GONE)
                } else {
                    views.setImageViewResource(R.id.widget_focus_btn_toggle, android.R.drawable.ic_media_play)
                    views.setTextViewText(R.id.widget_focus_time_text, label)
                    views.setChronometer(R.id.widget_focus_time_chronometer, 0L, "%s", false)
                    views.setViewVisibility(R.id.widget_focus_time_text, android.view.View.VISIBLE)
                    views.setViewVisibility(R.id.widget_focus_time_chronometer, android.view.View.GONE)
                }

                views.setTextViewText(R.id.widget_focus_status, status)
                manager.updateAppWidget(id, views)
            }
        }
    }
}
