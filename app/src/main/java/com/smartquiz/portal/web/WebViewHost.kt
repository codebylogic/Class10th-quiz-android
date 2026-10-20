package com.smartquiz.portal.web

import android.annotation.SuppressLint
import android.graphics.Color
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * PRD Section 6.4, 7.3 & 10 — WebViewHost
 *
 * Configures the full-screen WebView with:
 * - JavaScript on, DOM storage (localStorage + IndexedDB) on
 * - File access off, Content access off, Zoom off
 * - Hardware acceleration enabled
 * - Local-origin lock: blocks any top-level navigation away from the local asset server
 */
class WebViewHost(
    private val webView: WebView,
    private val localServer: LocalAssetServer,
    private val nativeBridge: NativeBridge,
    private val onFirstPageReady: () -> Unit
) {
    private var initialLoadCompleted = false

    @SuppressLint("SetJavaScriptEnabled")
    fun configure() {
        webView.setBackgroundColor(Color.parseColor("#0B0D14"))
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            // Security rules (PRD Section 7.3)
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false

            // Disable pinch/zoom so the web UI feels like a native app (PRD Section 6.4)
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // Crisp typography & layout
            textZoom = 100
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        // Attach the minimal @JavascriptInterface bridge
        webView.addJavascriptInterface(nativeBridge, NativeBridge.JS_INTERFACE_NAME)

        webView.webViewClient = object : WebViewClient() {

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request == null) return null
                return localServer.shouldInterceptRequest(request)
                    ?: super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return true
                // Keep all navigation strictly inside the local asset origin (PRD Section 6.4 & 7.3)
                val isAllowedLocal = url.host == localServer.allowedOriginHost
                return !isAllowedLocal
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!initialLoadCompleted) {
                    initialLoadCompleted = true
                    onFirstPageReady()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && !initialLoadCompleted) {
                    initialLoadCompleted = true
                    onFirstPageReady()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                return true
            }
        }
    }

    fun loadApp() {
        webView.loadUrl(localServer.startUrl)
    }
}
