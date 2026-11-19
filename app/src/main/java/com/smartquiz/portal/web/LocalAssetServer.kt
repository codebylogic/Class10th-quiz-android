package com.smartquiz.portal.web

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * LocalAssetServer
 *
 * Two things are served:
 *
 * 1. The app itself (`assets/web/`) through [WebViewAssetLoader] at
 *    `https://appassets.androidplatform.net/` — no socket involved.
 *
 * 2. **Reels** — the user's own `.mp4` files from shared storage. Video needs real HTTP with
 *    Range support (the media player issues byte-range requests), so a tiny loopback HTTP
 *    server is always started on 127.0.0.1. Routes:
 *      GET /reels/list      -> JSON { folder, allowed, exists, count, files: [...] }
 *      GET /reels/v/<name>  -> the video file, with Range (206 Partial Content) support
 *
 * The server binds strictly to 127.0.0.1 and refuses any path outside the reels folder.
 */
class LocalAssetServer(
    private val context: Context,
    private val useEmbeddedSocketServer: Boolean = false
) {
    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val DEFAULT_START_URL = "https://$ASSET_HOST/index.html"
        private const val STREAM_BUFFER = 64 * 1024
    }

    // ---------- Option A: WebViewAssetLoader (the app itself) ----------
    private val assetLoader: WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(ASSET_HOST)
        .addPathHandler("/") { path ->
            val cleanPath = path.trimStart('/').ifEmpty { "index.html" }
            openWebAssetResponse(cleanPath)
        }
        .build()

    // ---------- Option B: loopback HTTP server (always on, for reels) ----------
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

    /** Base URL the WebView should use for reels (empty until the server is bound). */
    val reelsBaseUrl: String
        get() = if (boundPort > 0) "http://127.0.0.1:$boundPort/reels" else ""

    val allowedOriginHost: String
        get() = if (useEmbeddedSocketServer) "127.0.0.1" else ASSET_HOST

    fun start() {
        if (isRunning.getAndSet(true)) return
        val socket = try {
            ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        } catch (_: Exception) {
            isRunning.set(false)
            return
        }
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

    // ==========================================================================
    //  App assets (WebViewAssetLoader path)
    // ==========================================================================
    private fun openWebAssetResponse(cleanPath: String): WebResourceResponse? {
        return try {
            val assetPath = "web/$cleanPath"
            val inputStream = context.assets.open(assetPath)
            val mimeType = guessMimeType(cleanPath)
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

    // ==========================================================================
    //  Loopback HTTP server
    // ==========================================================================
    private fun handleSocketClient(client: Socket) {
        client.use { sock ->
            val output = BufferedOutputStream(sock.getOutputStream())
            try {
                val reader = BufferedReader(InputStreamReader(sock.getInputStream(), Charsets.ISO_8859_1))
                val requestLine = reader.readLine() ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) return

                var rangeHeader: String? = null
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) break
                    if (line.startsWith("Range:", ignoreCase = true)) {
                        rangeHeader = line.substringAfter(":").trim()
                    }
                }

                val rawPath = Uri.parse(parts[1]).path?.trimStart('/')?.ifEmpty { "index.html" }
                    ?: "index.html"
                val origin = "http://127.0.0.1:$boundPort"

                when {
                    rawPath == "reels/list" -> {
                        writeBytes(output, 200, "OK", "application/json",
                            reelsListJson().toByteArray(Charsets.UTF_8), origin, null)
                    }

                    rawPath.startsWith("reels/v/") -> {
                        val name = try {
                            URLDecoder.decode(rawPath.removePrefix("reels/v/"), "UTF-8")
                        } catch (_: Exception) {
                            ""
                        }
                        val file = ReelsStore.resolve(name)
                        if (file == null) {
                            writeBytes(output, 404, "Not Found", "text/plain",
                                "Not Found".toByteArray(), origin, null)
                        } else {
                            writeFile(output, file, guessMimeType(file.name), rangeHeader, origin)
                        }
                    }

                    else -> {
                        val bytes = context.assets.open("web/$rawPath").use { it.readBytes() }
                        writeBytes(output, 200, "OK", guessMimeType(rawPath), bytes, origin, null)
                    }
                }
                output.flush()
            } catch (_: Exception) {
                try {
                    writeBytes(output, 404, "Not Found", "text/plain", "Not Found".toByteArray(),
                        "http://127.0.0.1:$boundPort", null)
                    output.flush()
                } catch (_: Exception) {}
            }
        }
    }

    private fun reelsListJson(): String {
        val files = ReelsStore.listVideos()
        val arr = JSONArray()
        files.forEach { f ->
            arr.put(JSONObject().apply {
                put("name", f.name)
                put("size", f.length())
                put("mtime", f.lastModified())
            })
        }
        return JSONObject().apply {
            put("folder", ReelsStore.FOLDER_PATH)
            put("allowed", ReelsStore.hasAccess(context))
            put("exists", ReelsStore.folderExists())
            put("count", files.size)
            put("files", arr)
        }.toString()
    }

    /** Plain (non-range) response. */
    private fun writeBytes(
        output: OutputStream,
        status: Int,
        reason: String,
        mime: String,
        bytes: ByteArray,
        origin: String,
        extraHeaders: Map<String, String>?
    ) {
        val charset = if (isTextMime(mime)) "; charset=utf-8" else ""
        val sb = StringBuilder()
        sb.append("HTTP/1.1 $status $reason\r\n")
        sb.append("Content-Type: $mime$charset\r\n")
        sb.append("Content-Length: ${bytes.size}\r\n")
        sb.append("Accept-Ranges: bytes\r\n")
        sb.append("Access-Control-Allow-Origin: $origin\r\n")
        sb.append("Cache-Control: no-cache\r\n")
        extraHeaders?.forEach { (k, v) -> sb.append("$k: $v\r\n") }
        sb.append("Connection: close\r\n\r\n")
        output.write(sb.toString().toByteArray(Charsets.ISO_8859_1))
        output.write(bytes)
    }

    /** Streams a file, honouring a single `bytes=start-end` Range. */
    private fun writeFile(
        output: OutputStream,
        file: File,
        mime: String,
        rangeHeader: String?,
        origin: String
    ) {
        val total = file.length()
        if (total <= 0) {
            writeBytes(output, 404, "Not Found", "text/plain", "Empty".toByteArray(), origin, null)
            return
        }

        var start = 0L
        var end = total - 1
        var partial = false

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            val spec = rangeHeader.removePrefix("bytes=").split(",").first().trim()
            val dash = spec.indexOf('-')
            if (dash >= 0) {
                val sStr = spec.substring(0, dash).trim()
                val eStr = spec.substring(dash + 1).trim()
                if (sStr.isEmpty()) {
                    // suffix range: last N bytes
                    val n = eStr.toLongOrNull() ?: 0L
                    if (n > 0) {
                        start = (total - n).coerceAtLeast(0)
                        end = total - 1
                        partial = true
                    }
                } else {
                    start = sStr.toLongOrNull() ?: 0L
                    end = if (eStr.isEmpty()) total - 1 else (eStr.toLongOrNull() ?: (total - 1))
                    if (start in 0 until total) {
                        if (end >= total) end = total - 1
                        if (start <= end) partial = true
                    }
                }
            }
            if (!partial) {
                // Unsatisfiable range
                val sb = StringBuilder()
                sb.append("HTTP/1.1 416 Range Not Satisfiable\r\n")
                sb.append("Content-Range: bytes */$total\r\n")
                sb.append("Content-Length: 0\r\n")
                sb.append("Accept-Ranges: bytes\r\n")
                sb.append("Access-Control-Allow-Origin: $origin\r\n")
                sb.append("Connection: close\r\n\r\n")
                output.write(sb.toString().toByteArray(Charsets.ISO_8859_1))
                return
            }
        }

        val length = end - start + 1
        val sb = StringBuilder()
        if (partial) {
            sb.append("HTTP/1.1 206 Partial Content\r\n")
            sb.append("Content-Range: bytes $start-$end/$total\r\n")
        } else {
            sb.append("HTTP/1.1 200 OK\r\n")
        }
        sb.append("Content-Type: $mime\r\n")
        sb.append("Content-Length: $length\r\n")
        sb.append("Accept-Ranges: bytes\r\n")
        sb.append("Access-Control-Allow-Origin: $origin\r\n")
        sb.append("Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n")
        sb.append("Cache-Control: no-cache\r\n")
        sb.append("Connection: close\r\n\r\n")
        output.write(sb.toString().toByteArray(Charsets.ISO_8859_1))

        RandomAccessFile(file, "r").use { raf ->
            raf.seek(start)
            val buf = ByteArray(STREAM_BUFFER)
            var remaining = length
            while (remaining > 0) {
                val want = minOf(buf.size.toLong(), remaining).toInt()
                val read = raf.read(buf, 0, want)
                if (read <= 0) break
                output.write(buf, 0, read)
                remaining -= read
            }
        }
    }

    // ==========================================================================
    //  Helpers
    // ==========================================================================
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
            lower.endsWith(".gif") -> "image/gif"
            lower.endsWith(".webp") -> "image/webp"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".ttf") -> "font/ttf"
            lower.endsWith(".otf") -> "font/otf"
            // .mp4 / .m4v are video here; .m4a is audio
            lower.endsWith(".mp4") || lower.endsWith(".m4v") || lower.endsWith(".mov") -> "video/mp4"
            lower.endsWith(".mkv") -> "video/x-matroska"
            lower.endsWith(".3gp") -> "video/3gpp"
            lower.endsWith(".m4a") -> "audio/mp4"
            lower.endsWith(".mp3") -> "audio/mpeg"
            lower.endsWith(".ogg") || lower.endsWith(".oga") -> "audio/ogg"
            lower.endsWith(".wav") -> "audio/wav"
            lower.endsWith(".webm") -> "audio/webm"
            lower.endsWith(".opus") -> "audio/ogg"
            else -> "application/octet-stream"
        }
    }
}
