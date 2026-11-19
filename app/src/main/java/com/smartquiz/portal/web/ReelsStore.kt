package com.smartquiz.portal.web

import android.content.Context
import android.os.Build
import android.os.Environment
import java.io.File

/**
 * ReelsStore — finds and reads the user's own reel videos from shared storage.
 *
 * The folder name on disk varies ("output" vs "outputs"), so we never trust a single
 * hard-coded path. We try the known candidates first, then look one level inside
 * `data/`, then do a bounded walk under the compressor root. The folder that actually
 * contains videos wins.
 *
 * Requires "All files access" (MANAGE_EXTERNAL_STORAGE) on Android 11+, or
 * READ_EXTERNAL_STORAGE on older versions.
 */
object ReelsStore {

    private const val COMPRESSOR_ROOT = "/storage/emulated/0/SARVER/reel-compressor"

    /** Shown to the user when nothing is found. */
    const val PRIMARY_FOLDER = "$COMPRESSOR_ROOT/data/outputs"

    private val CANDIDATES = listOf(
        "$COMPRESSOR_ROOT/data/outputs",
        "$COMPRESSOR_ROOT/data/output",
        "$COMPRESSOR_ROOT/outputs",
        "$COMPRESSOR_ROOT/output",
        "$COMPRESSOR_ROOT/data"
    )

    private val VIDEO_EXTENSIONS = setOf("mp4", "m4v", "webm", "mkv", "mov", "3gp")

    private const val MAX_DEPTH = 3
    private const val MAX_DIRS = 400

    // ------------------------------------------------------------------ utils
    private fun subDirs(dir: File): List<File> = try {
        dir.listFiles()?.filter { it.isDirectory && !it.name.startsWith(".") } ?: emptyList()
    } catch (_: Exception) {
        emptyList()
    }

    private fun videosIn(dir: File): List<File> = try {
        dir.listFiles()
            ?.filter { it.isFile && it.extension.lowercase() in VIDEO_EXTENSIONS }
            ?.sortedBy { it.name.lowercase() }
            ?: emptyList()
    } catch (_: Exception) {
        emptyList()
    }

    // ------------------------------------------------------------- access
    fun hasAccess(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            @Suppress("DEPRECATION")
            context.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    }

    // ------------------------------------------------------------- folder discovery
    /**
     * The folder we will actually read from: the first location that contains videos.
     * Falls back to the first location that merely exists, then to [PRIMARY_FOLDER].
     */
    fun findFolder(): File {
        // 1. known candidates that actually contain videos
        for (path in CANDIDATES) {
            val dir = File(path)
            if (dir.isDirectory && videosIn(dir).isNotEmpty()) return dir
        }
        // 2. any sub-folder of data/ that contains videos
        for (dir in subDirs(File("$COMPRESSOR_ROOT/data"))) {
            if (videosIn(dir).isNotEmpty()) return dir
        }
        // 3. bounded walk under the compressor root
        val budget = intArrayOf(MAX_DIRS)
        walkForVideos(File(COMPRESSOR_ROOT), 0, budget)?.let { return it }
        // 4. nothing has videos — report the first existing candidate, else the primary
        for (path in CANDIDATES) {
            val dir = File(path)
            if (dir.isDirectory) return dir
        }
        return File(PRIMARY_FOLDER)
    }

    private fun walkForVideos(dir: File, depth: Int, budget: IntArray): File? {
        if (depth > MAX_DEPTH || budget[0] <= 0) return null
        if (!dir.isDirectory) return null
        budget[0]--
        if (videosIn(dir).isNotEmpty()) return dir
        for (child in subDirs(dir)) {
            walkForVideos(child, depth + 1, budget)?.let { return it }
        }
        return null
    }

    fun folderExists(): Boolean = findFolder().isDirectory

    /** All playable reels in the resolved folder. */
    fun listVideos(): List<File> = videosIn(findFolder())

    /**
     * Resolves a file name to a real file inside the resolved folder.
     * Returns null for anything that would escape it (path traversal, sub-directories).
     */
    fun resolve(name: String): File? {
        if (name.isBlank() || name.length > 255) return null
        if (name.contains('/') || name.contains('\\') || name.contains("..")) return null
        val dir = findFolder()
        val file = File(dir, name)
        if (!file.isFile) return null
        return try {
            val dirPath = dir.canonicalPath + File.separator
            if (file.canonicalPath.startsWith(dirPath)) file else null
        } catch (_: Exception) {
            null
        }
    }

    /** Debug aid: which candidate paths exist and how many videos each holds. */
    fun scanReport(): List<Pair<String, Int>> {
        val out = ArrayList<Pair<String, Int>>()
        for (path in CANDIDATES) {
            val dir = File(path)
            out.add(path to if (dir.isDirectory) videosIn(dir).size else -1)
        }
        return out
    }
}
