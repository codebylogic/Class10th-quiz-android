package com.smartquiz.portal.web

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * PRD Section 6.2, 6.3 & 6.4 — LocalAssetServer
 *
 * Supports both architectures described in the PRD:
 * - Option A (Default Recommended): androidx.webkit.WebViewAssetLoader serving `assets/web/`
 *   at `https://appassets.androidplatform.net/` without opening any socket or port.
 * - Option B (Optional Embedded HTTP Server): Lightweight local HTTP server bound strictly to
 *   `127.0.0.1` on an ephemeral port, serving `assets/web/` with true HTTP semantics.
 */
class LocalAssetServer(
    private val context: Context,
    private val useEmbeddedSocketServer: Boolean = false
) {
    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val DEFAULT_START_URL = "https://$ASSET_HOST/index.html"
    }

    // Option A: WebViewAssetLoader
    private val assetLoader: WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(ASSET_HOST)
        .addPathHandler("/") { path ->
            val cleanPath = path.trimStart('/').ifEmpty { "index.html" }
            openWebAssetResponse(cleanPath)
        }
        .build()

    // Option B: Embedded loopback HTTP server (only started if useEmbeddedSocketServer == true)
    private var serverSocket: ServerSocket? = null
    private var executor: ExecutorService? = null
    private val isRunning = AtomicBoolean(false)
    var boundPort: Int = -1
        private set

    val startUrl: String
        get() = if (useEmbeddedSocketServer && boundPort > 0) {
            "http://127.0.0.1:$boundPort/index.html"
        } else {
            DEFAULT_START_URL
        }

    val allowedOriginHost: String
        get() = if (useEmbeddedSocketServer) "127.0.0.1" else ASSET_HOST

    fun start() {
        if (!useEmbeddedSocketServer || isRunning.getAndSet(true)) return
        val socket = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        serverSocket = socket
        boundPort = socket.localPort
        val pool = Executors.newCachedThreadPool()
        executor = pool
        pool.execute {
            while (isRunning.get()) {
                try {
                    val client = socket.accept()
                    pool.execute { handleSocketClient(client) }
                } catch (_: Exception) {
                    break
                }
            }
        }
    }

    fun stop() {
        if (!isRunning.getAndSet(false)) return
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        executor?.shutdownNow()
    }

    fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
        val url: Uri = request.url ?: return null
        if (url.host == ASSET_HOST) {
            return assetLoader.shouldInterceptRequest(url)
        }
        return null
    }

    private fun openWebAssetResponse(cleanPath: String): WebResourceResponse? {
        return try {
            val assetPath = "web/$cleanPath"
            val inputStream = context.assets.open(assetPath)
            val mimeType = guessMimeType(cleanPath)
            // Text assets carry a charset; binary assets (fonts, audio) must not.
            val encoding = if (isTextMime(mimeType)) "UTF-8" else null
            val headers = mapOf(
                "Access-Control-Allow-Origin" to "https://$ASSET_HOST",
                "Cache-Control" to "no-cache"
            )
            WebResourceResponse(mimeType, encoding, 200, "OK", headers, inputStream)
        } catch (_: Exception) {
            null
        }
    }

    private fun handleSocketClient(client: Socket) {
        client.use { sock ->
            val reader = BufferedReader(InputStreamReader(sock.getInputStream()))
            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return
            val rawPath = Uri.parse(parts[1]).path?.trimStart('/')?.ifEmpty { "index.html" } ?: "index.html"
            val output: OutputStream = sock.getOutputStream()
            try {
                val bytes = context.assets.open("web/$rawPath").use { it.readBytes() }
                val mime = guessMimeType(rawPath)
                val charset = if (isTextMime(mime)) "; charset=utf-8" else ""
                val header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: $mime$charset\r\n" +
                    "Content-Length: ${bytes.size}\r\n" +
                    "Access-Control-Allow-Origin: http://127.0.0.1:$boundPort\r\n" +
                    "Connection: close\r\n\r\n"
                output.write(header.toByteArray(Charsets.UTF_8))
                output.write(bytes)
                output.flush()
            } catch (_: Exception) {
                val msg = "404 Not Found"
                val header = "HTTP/1.1 404 Not Found\r\nContent-Length: ${msg.length}\r\nConnection: close\r\n\r\n$msg"
                output.write(header.toByteArray(Charsets.UTF_8))
                output.flush()
            }
        }
    }


    private fun isTextMime(mime: String): Boolean =
        mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json")

    private fun guessMimeType(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".html") -> "text/html"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".js") -> "application/javascript"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".ttf") -> "font/ttf"
            lower.endsWith(".otf") -> "font/otf"
            lower.endsWith(".m4a") || lower.endsWith(".mp4") -> "audio/mp4"
            lower.endsWith(".mp3") -> "audio/mpeg"
            lower.endsWith(".ogg") || lower.endsWith(".oga") -> "audio/ogg"
            lower.endsWith(".wav") -> "audio/wav"
            else -> "application/octet-stream"
        }
    }
}
