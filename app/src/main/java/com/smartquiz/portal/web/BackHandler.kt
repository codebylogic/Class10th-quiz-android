package com.smartquiz.portal.web

import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.smartquiz.portal.R

/**
 * PRD Section 6.4 & 6.6 — BackHandler
 *
 * Routes hardware/gesture back presses:
 * 1. First asks the SPA router (`window.SmartQuizApp.onBackPressed()`) if a modal/bottom-sheet
 *    is open or if the route is deeper than `#/home`.
 * 2. Falls back to `webView.canGoBack()` -> `webView.goBack()`.
 * 3. At `#/home` root, requires a double-tap within 2 seconds (or opens the web exit dialog)
 *    before finishing the Activity.
 */
class BackHandler(
    private val activity: ComponentActivity,
    private val webView: WebView
) {
    private var lastBackPressTimeMs: Long = 0L

    fun attach() {
        activity.onBackPressedDispatcher.addCallback(
            activity,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webView.evaluateJavascript(
                        "(function() { return window.SmartQuizApp && window.SmartQuizApp.handleBackNavigation ? window.SmartQuizApp.handleBackNavigation() : 'ROOT'; })();"
                    ) { result ->
                        val cleanResult = result?.trim('"') ?: "ROOT"
                        if (cleanResult == "HANDLED") {
                            return@evaluateJavascript
                        }
                        if (webView.canGoBack()) {
                            webView.goBack()
                            return@evaluateJavascript
                        }
                        val now = System.currentTimeMillis()
                        if (now - lastBackPressTimeMs < 2000L) {
                            activity.finish()
                        } else {
                            lastBackPressTimeMs = now
                            Toast.makeText(
                                activity,
                                activity.getString(R.string.exit_confirm_toast),
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
            }
        )
    }
}
