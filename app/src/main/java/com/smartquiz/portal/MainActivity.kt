package com.smartquiz.portal

import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.smartquiz.portal.web.BackHandler
import com.smartquiz.portal.web.LocalAssetServer
import com.smartquiz.portal.web.NativeBridge
import com.smartquiz.portal.web.WebViewHost
import java.util.concurrent.atomic.AtomicBoolean

/**
 * PRD Section 6.4 & 6.6 — MainActivity
 *
 * Thin Kotlin shell hosting:
 * - Native SplashScreen (visible immediately on cold start until WebView renders)
 * - Edge-to-edge system window with status/navigation bar inset forwarding
 * - LocalAssetServer (WebViewAssetLoader by default)
 * - Full-screen WebView + NativeBridge + BackHandler
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var localServer: LocalAssetServer
    private lateinit var appPrefs: AppPrefs
    private val isWebViewReady = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !isWebViewReady.get() }

        super.onCreate(savedInstanceState)

        // Edge-to-edge layout
        WindowCompat.setDecorFitsSystemWindows(window, false)

        appPrefs = AppPrefs(applicationContext)
        localServer = LocalAssetServer(applicationContext, useEmbeddedSocketServer = false)
        localServer.start()

        val rootContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF0B0D14.toInt())
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        rootContainer.addView(webView)
        setContentView(rootContainer)

        // Apply system window insets so status bar & navigation bar never overlap interactive controls
        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        val nativeBridge = NativeBridge(
            activity = this,
            webViewProvider = { webView },
            appPrefs = appPrefs,
            allowedHost = localServer.allowedOriginHost,
            scope = lifecycleScope
        )

        val webViewHost = WebViewHost(
            webView = webView,
            localServer = localServer,
            nativeBridge = nativeBridge,
            onFirstPageReady = {
                isWebViewReady.set(true)
            }
        )
        webViewHost.configure()

        BackHandler(activity = this, webView = webView).attach()

        if (savedInstanceState == null) {
            webViewHost.loadApp()
        } else {
            webView.restoreState(savedInstanceState)
            isWebViewReady.set(true)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) {
            webView.saveState(outState)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        if (::localServer.isInitialized) {
            localServer.stop()
        }
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(NativeBridge.JS_INTERFACE_NAME)
            webView.destroy()
        }
        super.onDestroy()
    }
}
