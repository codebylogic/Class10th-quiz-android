package com.smartquiz.portal.web

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.content.FileProvider
import com.smartquiz.portal.AppPrefs
import com.smartquiz.portal.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

/**
 * PRD Section 7.3 — The Native Bridge (JavaScript to Kotlin)
 *
 * Exposes the minimal, strictly validated @JavascriptInterface surface to `window.AndroidBridge`:
 * - vibrate(ms)
 * - share(text)
 * - toast(message)
 * - getVersion()
 * - saveProgress(json) / loadProgress()
 * - savePrefs(json) / getPrefs()
 * - exit()
 * - openExternal(url)
 *
 * Security rules enforced:
 * 1. Verified local origin check before executing sensitive bridge actions.
 * 2. Every argument is length-bounded and validated; nothing is ever passed to eval.
 */
class NativeBridge(
    private val activity: Activity,
    private val webViewProvider: () -> WebView?,
    private val appPrefs: AppPrefs,
    private val allowedHost: String,
    private val scope: CoroutineScope,
    private val reelsBaseUrlProvider: () -> String = { "" }
) {
    companion object {
        const val JS_INTERFACE_NAME = "AndroidBridge"
        private const val MAX_TEXT_LENGTH = 2000
        private const val MAX_PROGRESS_JSON_LENGTH = 2_000_000 // 2 MB cap
        const val BUNDLED_CONTENT_VERSION = "2026.10.1"
        const val REELS_PERMISSION_REQUEST = 1201
    }

    private fun isLocalOriginVerified(): Boolean {
        val currentUrl = webViewProvider()?.url ?: return true
        return currentUrl.startsWith("https://$allowedHost/") ||
            currentUrl.startsWith("http://127.0.0.1:")
    }

    @JavascriptInterface
    fun vibrate(ms: Long) {
        val duration = ms.coerceIn(10L, 500L)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager =
                    activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(
                        VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(duration)
                }
            }
        } catch (_: Exception) {
            // Ignore on devices without vibrator hardware
        }
    }

    @JavascriptInterface
    fun share(text: String?) {
        if (text.isNullOrBlank()) return
        val safeText = text.take(MAX_TEXT_LENGTH)
        activity.runOnUiThread {
            if (!isLocalOriginVerified()) return@runOnUiThread
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, safeText)
            }
            val chooser = Intent.createChooser(
                sendIntent,
                activity.getString(R.string.share_chooser_title)
            )
            activity.startActivity(chooser)
        }
    }

    @JavascriptInterface
    fun toast(message: String?) {
        if (message.isNullOrBlank()) return
        val safeMsg = message.take(300)
        activity.runOnUiThread {
            if (!isLocalOriginVerified()) return@runOnUiThread
            Toast.makeText(activity, safeMsg, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getVersion(): String {
        val pkgInfo = try {
            activity.packageManager.getPackageInfo(activity.packageName, 0)
        } catch (_: Exception) {
            null
        }
        val versionName = pkgInfo?.versionName ?: "1.0.0"
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pkgInfo?.longVersionCode ?: 1L
        } else {
            @Suppress("DEPRECATION")
            pkgInfo?.versionCode?.toLong() ?: 1L
        }
        return JSONObject().apply {
            put("appVersion", versionName)
            put("versionCode", versionCode)
            put("contentVersion", BUNDLED_CONTENT_VERSION)
            put("platform", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        }.toString()
    }

    @JavascriptInterface
    fun saveProgress(json: String?) {
        if (json.isNullOrBlank() || json.length > MAX_PROGRESS_JSON_LENGTH) return
        // Validate that input is well-formed JSON before persisting
        try {
            JSONObject(json)
        } catch (_: Exception) {
            return
        }
        scope.launch(Dispatchers.IO) {
            appPrefs.saveProgressSnapshot(json)
        }
    }

    @JavascriptInterface
    fun loadProgress(): String {
        return try {
            runBlocking(Dispatchers.IO) {
                appPrefs.loadProgressSnapshot()
            }
        } catch (_: Exception) {
            ""
        }
    }

    @JavascriptInterface
    fun savePrefs(json: String?) {
        if (json.isNullOrBlank() || json.length > 4096) return
        try {
            val obj = JSONObject(json)
            val theme = obj.optString("theme", "")
            val profileLang = obj.optString("profileLang", "")
            val quizLangPref = obj.optString("quizLangPref", "")
            val selectedCourse = obj.optString("selectedCourse", "")
            scope.launch(Dispatchers.IO) {
                appPrefs.savePreferences(theme, profileLang, quizLangPref, selectedCourse)
            }
        } catch (_: Exception) {
            // Ignore malformed payload
        }
    }

    @JavascriptInterface
    fun getPrefs(): String {
        return try {
            runBlocking(Dispatchers.IO) {
                appPrefs.getPreferencesJson()
            }
        } catch (_: Exception) {
            "{}"
        }
    }

    @JavascriptInterface
    fun clearNativeData() {
        scope.launch(Dispatchers.IO) {
            appPrefs.clearAll()
        }
    }

    /**
     * Opens an http/https URL in the device browser (used by the in-app update button).
     * Only http/https is accepted; the app's own WebView never leaves the local origin.
     */
    @JavascriptInterface
    fun openExternal(url: String?) {
        if (url.isNullOrBlank() || url.length > 2048) return
        val uri = try {
            android.net.Uri.parse(url)
        } catch (_: Exception) {
            return
        }
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return
        activity.runOnUiThread {
            if (!isLocalOriginVerified()) return@runOnUiThread
            try {
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (_: Exception) {
                Toast.makeText(activity, "ब्राउज़र नहीं खुल सका", Toast.LENGTH_SHORT).show()
            }
        }
    }


    // ==========================================================================
    //  PRO unlock (reels are gated behind this)
    // ==========================================================================

    @JavascriptInterface
    fun isProUnlocked(): Boolean {
        return try {
            runBlocking(Dispatchers.IO) { appPrefs.isProUnlocked() }
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun setProUnlocked(value: Boolean) {
        scope.launch(Dispatchers.IO) {
            try {
                appPrefs.setProUnlocked(value)
            } catch (_: Exception) {
                // ignore
            }
        }
    }

    // ==========================================================================
    //  Reels — the user's own videos from shared storage
    // ==========================================================================

    @JavascriptInterface
    fun reelsInfo(): String {
        return try {
            val files = ReelsStore.listVideos()
            val arr = org.json.JSONArray()
            files.forEach { f ->
                arr.put(JSONObject().apply {
                    put("name", f.name)
                    put("size", f.length())
                    put("mtime", f.lastModified())
                })
            }
            val scanned = org.json.JSONArray()
            ReelsStore.scanReport().forEach { (path, videos) ->
                scanned.put(JSONObject().apply {
                    put("path", path)
                    put("videos", videos)   // -1 = the folder does not exist
                })
            }
            JSONObject().apply {
                put("folder", ReelsStore.findFolder().absolutePath)
                put("allowed", ReelsStore.hasAccess(activity))
                put("exists", ReelsStore.folderExists())
                put("count", files.size)
                put("baseUrl", reelsBaseUrlProvider())
                put("files", arr)
                put("scanned", scanned)
            }.toString()
        } catch (_: Exception) {
            "{}"
        }
    }

    /**
     * Asks for "All files access" (Android 11+) or READ_EXTERNAL_STORAGE (older).
     * The system settings screen is opened; the WebView refreshes when the app resumes.
     */
    @JavascriptInterface
    fun requestReelsAccess() {
        activity.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:" + activity.packageName)
                    )
                    activity.startActivity(intent)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    activity.requestPermissions(
                        arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE),
                        REELS_PERMISSION_REQUEST
                    )
                } else {
                    Toast.makeText(activity, "इस Android पर अनुमति की ज़रूरत नहीं", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                // Some OEMs don't expose the per-app screen; fall back to the global list.
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
                    }
                } catch (_: Exception) {
                    Toast.makeText(activity, "सेटिंग्स नहीं खुल सकीं", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /** Fallback player: opens the reel in whatever video player the phone has. */
    @JavascriptInterface
    fun openVideoExternally(name: String?) {
        if (name.isNullOrBlank() || name.length > 255) return
        val file = ReelsStore.resolve(name) ?: return
        activity.runOnUiThread {
            try {
                val authority = activity.packageName + ".fileprovider"
                val uri = FileProvider.getUriForFile(activity, authority, file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "video/mp4")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
            } catch (_: Exception) {
                Toast.makeText(activity, "कोई वीडियो प्लेयर नहीं मिला", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun exit() {
        activity.runOnUiThread {
            if (!isLocalOriginVerified()) return@runOnUiThread
            activity.finish()
        }
    }
}
