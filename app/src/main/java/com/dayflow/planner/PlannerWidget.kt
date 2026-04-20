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

/**
 * Home screen widget that shows:
 *  - Number of pending (non-completed) tasks for today
 *  - Title of the earliest upcoming task (by deadline)
 *  - Its deadline formatted as HH:MM
 */
class PlannerWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            widgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_planner)

            // Tap on widget → open app
            val openIntent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(android.R.id.content, pendingIntent)

            // Load tasks from DataStore
            CoroutineScope(Dispatchers.IO).launch {
                val store = PlannerStore(context.applicationContext)
                val state = store.appState.first()

                val todayCal = Calendar.getInstance()
                val todayYear = todayCal.get(Calendar.YEAR)
                val todayMonth = todayCal.get(Calendar.MONTH)
                val todayDay = todayCal.get(Calendar.DAY_OF_MONTH)
                val nowMillis = System.currentTimeMillis()

                // Tasks that are today (by deadline date) and not completed
                val todayTasks = state.tasks.filter { task ->
                    if (task.completed) return@filter false
                    if (task.deadlineMillis != null) {
                        val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
                        tc.get(Calendar.YEAR) == todayYear &&
                        tc.get(Calendar.MONTH) == todayMonth &&
                        tc.get(Calendar.DAY_OF_MONTH) == todayDay
                    } else {
                        true // tasks without deadline count as "today"
                    }
                }

                // Next upcoming task (closest deadline in the future)
                val nextTask = state.tasks
                    .filter { !it.completed && it.deadlineMillis != null && it.deadlineMillis > nowMillis }
                    .minByOrNull { it.deadlineMillis!! }

                val countText = "${todayTasks.size} задач${taskEnding(todayTasks.size)} сьогодні"
                val nextTitle = nextTask?.title ?: if (todayTasks.isNotEmpty()) todayTasks.first().title else "Усе виконано! 🎉"
                val deadlineText = if (nextTask?.deadlineMillis != null) {
                    val cal = Calendar.getInstance().apply { timeInMillis = nextTask.deadlineMillis }
                    "⏰ до %02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
                } else ""

                views.setTextViewText(R.id.widget_task_count, countText)
                views.setTextViewText(R.id.widget_next_task, nextTitle)
                views.setTextViewText(R.id.widget_deadline, deadlineText)

                appWidgetManager.updateAppWidget(widgetId, views)
            }
        }

        private fun taskEnding(count: Int): String = when {
            count % 10 == 1 && count % 100 != 11 -> "а"
            count % 10 in 2..4 && count % 100 !in 12..14 -> "и"
            else -> ""
        }
    }
}
