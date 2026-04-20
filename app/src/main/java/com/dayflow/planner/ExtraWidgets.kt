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

    companion object {
        fun updateFocus(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_focus)
            val tap = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(android.R.id.content, tap)

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

                views.setTextViewText(R.id.widget_focus_time, label)
                views.setTextViewText(R.id.widget_focus_status, status)
                manager.updateAppWidget(id, views)
            }
        }
    }
}
