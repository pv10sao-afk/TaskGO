package com.dayflow.planner

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

const val CHANNEL_ID = "dayflow_deadlines"
const val CHANNEL_NAME = "Дедлайни задач"
const val EXTRA_TASK_TITLE = "task_title"

/**
 * Creates the notification channel (safe to call multiple times).
 * Must be called before posting any notifications (Android 8.0+).
 */
fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Нагадування про дедлайни ваших задач"
            enableVibration(true)
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }
}

/**
 * Posts a deadline notification for a task.
 */
fun postDeadlineNotification(context: Context, taskTitle: String, taskId: Int) {
    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    }
    val pendingIntent = PendingIntent.getActivity(
        context, taskId, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle("⏰ Дедлайн: $taskTitle")
        .setContentText("Час виконати завдання!")
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .build()

    try {
        NotificationManagerCompat.from(context).notify(taskId, notification)
    } catch (e: SecurityException) {
        // Permission not granted yet – silently skip
    }
}

/**
 * BroadcastReceiver that fires when the scheduled alarm time arrives.
 */
class DeadlineAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TASK_TITLE) ?: return
        val id = intent.getIntExtra("task_id", 0)
        postDeadlineNotification(context, title, id)
    }
}
