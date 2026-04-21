package com.dayflow.planner

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.dayflow.planner.data.PlannerStore
import com.dayflow.planner.data.PlannerTask
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.Calendar

class TaskListWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            updateTaskListWidget(context, manager, id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.dayflow.planner.ACTION_TOGGLE_TASK") {
            val taskId = intent.getStringExtra("task_id") ?: return
            
            CoroutineScope(Dispatchers.IO).launch {
                val store = PlannerStore(context.applicationContext)
                store.toggleTaskCompleted(taskId)
            }
        }
    }

    companion object {
        fun updateTaskListWidget(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_task_list)
            
            val intent = Intent(context, TaskWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            }
            views.setRemoteAdapter(R.id.widget_task_list_view, intent)
            views.setEmptyView(R.id.widget_task_list_view, R.id.widget_task_list_empty)

            // Setup general tap on the widget to open app
            val appIntent = Intent(context, MainActivity::class.java)
            val appPendingIntent = PendingIntent.getActivity(
                context, 0, appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_task_list_title, appPendingIntent)

            // Setup item click template for toggling tasks
            val toggleIntent = Intent(context, TaskListWidget::class.java).apply {
                action = "com.dayflow.planner.ACTION_TOGGLE_TASK"
            }
            val togglePendingIntent = PendingIntent.getBroadcast(
                context, 0, toggleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            views.setPendingIntentTemplate(R.id.widget_task_list_view, togglePendingIntent)

            manager.updateAppWidget(id, views)
            manager.notifyAppWidgetViewDataChanged(id, R.id.widget_task_list_view)
        }
    }
}

class TaskWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return TaskWidgetFactory(this.applicationContext)
    }
}

class TaskWidgetFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var tasks: List<PlannerTask> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        // Safe to run blocking here since this is called in a background thread by the Widget framework
        runBlocking {
            val store = PlannerStore(context)
            val state = store.appState.first()
            val today = Calendar.getInstance()
            
            tasks = state.tasks.filter { task ->
                !task.completed && (task.deadlineMillis == null || run {
                    val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
                    tc.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR) &&
                    tc.get(Calendar.YEAR) == today.get(Calendar.YEAR)
                })
            }
        }
    }

    override fun onDestroy() {
        tasks = emptyList()
    }

    override fun getCount(): Int = tasks.size

    override fun getViewAt(position: Int): RemoteViews {
        val task = tasks.getOrNull(position) ?: return RemoteViews(context.packageName, R.layout.widget_task_item)
        val views = RemoteViews(context.packageName, R.layout.widget_task_item)

        views.setTextViewText(R.id.widget_task_title, task.title)
        
        val timeLabel = if (task.deadlineMillis != null) {
            val cal = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
            "%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
        } else {
            "Без часу"
        }
        views.setTextViewText(R.id.widget_task_time, timeLabel)
        
        // Setup fill in intent for the checkbox toggle
        val fillInIntent = Intent().apply {
            putExtra("task_id", task.id)
        }
        views.setOnClickFillInIntent(R.id.widget_task_item_root, fillInIntent)
        
        return views
    }

    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = false
}
