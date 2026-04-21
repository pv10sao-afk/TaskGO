package com.dayflow.planner

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.dayflow.planner.data.PlannerStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.Calendar

class CalendarWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            updateCalendarWidget(context, manager, id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.dayflow.planner.ACTION_PREV_MONTH" || intent.action == "com.dayflow.planner.ACTION_NEXT_MONTH") {
            val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                val prefs = context.getSharedPreferences("widget_cal_$id", Context.MODE_PRIVATE)
                var monthOffset = prefs.getInt("month_offset", 0)
                
                if (intent.action == "com.dayflow.planner.ACTION_PREV_MONTH") {
                    monthOffset--
                } else {
                    monthOffset++
                }
                
                prefs.edit().putInt("month_offset", monthOffset).apply()
                
                val manager = AppWidgetManager.getInstance(context)
                updateCalendarWidget(context, manager, id)
                manager.notifyAppWidgetViewDataChanged(id, R.id.widget_calendar_grid)
            }
        }
    }

    companion object {
        fun updateCalendarWidget(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_calendar)
            
            // Get current month offset
            val prefs = context.getSharedPreferences("widget_cal_$id", Context.MODE_PRIVATE)
            val monthOffset = prefs.getInt("month_offset", 0)
            
            val cal = Calendar.getInstance()
            cal.add(Calendar.MONTH, monthOffset)
            
            val monthNames = arrayOf("Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень")
            val title = "${monthNames[cal.get(Calendar.MONTH)]} ${cal.get(Calendar.YEAR)}"
            views.setTextViewText(R.id.widget_calendar_title, title)

            // Setup buttons
            val prevIntent = Intent(context, CalendarWidget::class.java).apply {
                action = "com.dayflow.planner.ACTION_PREV_MONTH"
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setOnClickPendingIntent(R.id.widget_calendar_prev, PendingIntent.getBroadcast(
                context, id * 2, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            ))

            val nextIntent = Intent(context, CalendarWidget::class.java).apply {
                action = "com.dayflow.planner.ACTION_NEXT_MONTH"
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setOnClickPendingIntent(R.id.widget_calendar_next, PendingIntent.getBroadcast(
                context, id * 2 + 1, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            ))
            
            // Open app on title tap
            val appIntent = Intent(context, MainActivity::class.java)
            views.setOnClickPendingIntent(R.id.widget_calendar_title, PendingIntent.getActivity(
                context, id, appIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            ))

            // GridView Service
            val gridIntent = Intent(context, CalendarWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                data = android.net.Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_calendar_grid, gridIntent)

            manager.updateAppWidget(id, views)
        }
    }
}

class CalendarWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return CalendarWidgetFactory(this.applicationContext, intent)
    }
}

class CalendarWidgetFactory(private val context: Context, intent: Intent) : RemoteViewsService.RemoteViewsFactory {
    private val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    private var days = emptyList<DayCell>()

    data class DayCell(val day: Int, val isCurrentMonth: Boolean, val hasTasks: Boolean, val isToday: Boolean)

    override fun onCreate() {}

    override fun onDataSetChanged() {
        val prefs = context.getSharedPreferences("widget_cal_$widgetId", Context.MODE_PRIVATE)
        val monthOffset = prefs.getInt("month_offset", 0)

        // Run blocking for state parsing
        val taskDates = try {
            runBlocking {
                PlannerStore(context).appState.first().tasks.filter { !it.completed && it.deadlineMillis != null }.map {
                    val cal = Calendar.getInstance().apply { timeInMillis = it.deadlineMillis!! }
                    Triple(cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH), cal.get(Calendar.YEAR))
                }.toSet()
            }
        } catch (e: Exception) {
            emptySet()
        }

        val cal = Calendar.getInstance()
        cal.add(Calendar.MONTH, monthOffset)
        
        val realToday = Calendar.getInstance()
        val isRealMonth = (realToday.get(Calendar.MONTH) == cal.get(Calendar.MONTH) && realToday.get(Calendar.YEAR) == cal.get(Calendar.YEAR))
        val currentDay = realToday.get(Calendar.DAY_OF_MONTH)

        cal.set(Calendar.DAY_OF_MONTH, 1)
        val firstDayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        // Normalize 1(Sun)-7(Sat) to 0(Mon)-6(Sun)
        var offset = firstDayOfWeek - Calendar.MONDAY
        if (offset < 0) offset += 7

        cal.add(Calendar.DAY_OF_MONTH, -offset)

        val targetMonth = Calendar.getInstance().apply { add(Calendar.MONTH, monthOffset) }.get(Calendar.MONTH)
        val targetYear = Calendar.getInstance().apply { add(Calendar.MONTH, monthOffset) }.get(Calendar.YEAR)

        val newDays = mutableListOf<DayCell>()
        for (i in 0 until 42) {
            val d = cal.get(Calendar.DAY_OF_MONTH)
            val m = cal.get(Calendar.MONTH)
            val y = cal.get(Calendar.YEAR)
            val isCurrentMonth = (m == targetMonth)
            val isToday = isRealMonth && isCurrentMonth && d == currentDay
            val hasTasks = taskDates.contains(Triple(d, m, y))

            newDays.add(DayCell(d, isCurrentMonth, hasTasks, isToday))
            cal.add(Calendar.DAY_OF_MONTH, 1)
        }
        days = newDays
    }

    override fun onDestroy() {
        days = emptyList()
    }

    override fun getCount(): Int = days.size

    override fun getViewAt(position: Int): RemoteViews {
        val cell = days.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.widget_calendar_cell)
        val views = RemoteViews(context.packageName, R.layout.widget_calendar_cell)

        views.setTextViewText(R.id.widget_cal_cell_text, cell.day.toString())
        
        // Colors
        if (!cell.isCurrentMonth) {
            views.setTextColor(R.id.widget_cal_cell_text, android.graphics.Color.parseColor("#445566"))
            views.setInt(R.id.widget_cal_cell_text, "setBackgroundResource", android.R.color.transparent)
        } else if (cell.isToday) {
            views.setTextColor(R.id.widget_cal_cell_text, android.graphics.Color.WHITE)
            // Use AccentMint color natively mapped
            views.setInt(R.id.widget_cal_cell_text, "setBackgroundResource", android.R.drawable.presence_online) // wait we need a custom shape or just color
            // RemoteViews limits shape setting. Let's just set the text color distinct
            views.setTextColor(R.id.widget_cal_cell_text, android.graphics.Color.parseColor("#5DE6A4"))
        } else {
            views.setTextColor(R.id.widget_cal_cell_text, android.graphics.Color.WHITE)
            views.setInt(R.id.widget_cal_cell_text, "setBackgroundResource", android.R.color.transparent)
        }

        if (cell.hasTasks) {
            views.setViewVisibility(R.id.widget_cal_cell_dot, android.view.View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_cal_cell_dot, android.view.View.INVISIBLE)
        }

        // Tap to open app
        val fillInIntent = Intent()
        views.setOnClickFillInIntent(R.id.widget_cal_cell_root, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? {
        val views = RemoteViews(context.packageName, R.layout.widget_calendar_cell)
        views.setTextViewText(R.id.widget_cal_cell_text, "")
        return views
    }
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = false
}
