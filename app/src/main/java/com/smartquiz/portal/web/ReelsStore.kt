package com.smartquiz.portal.web

import android.content.Context
import android.os.Build
import android.os.Environment
import java.io.File

/**
 * ReelsStore — reads the user's own reel folder from shared storage.
 *
 * The reels are NOT bundled in the APK. The app reads whatever `.mp4` files the user has
 * dropped into [FOLDER_PATH] (the output folder of their reel compressor), so the APK stays small.
 *
 * Requires "All files access" (MANAGE_EXTERNAL_STORAGE) on Android 11+, or READ_EXTERNAL_STORAGE
 * on older versions. [hasAccess] reports which case applies.
 */
object ReelsStore {

    const val FOLDER_PATH = "/storage/emulated/0/SARVER/reel-compressor/data/output"

    private val VIDEO_EXTENSIONS = setOf("mp4", "m4v", "webm", "mkv", "mov", "3gp")

    fun folder(): File = File(FOLDER_PATH)

    /** True when the app may read arbitrary files from shared storage. */
    fun hasAccess(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            @Suppress("DEPRECATION")
            context.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    }

    fun folderExists(): Boolean = folder().isDirectory

    /** All playable reels in the folder, sorted by name. Empty when the folder is missing. */
    fun listVideos(): List<File> {
        val dir = folder()
        if (!dir.isDirectory) return emptyList()
        return try {
            dir.listFiles()
                ?.filter { it.isFile && it.extension.lowercase() in VIDEO_EXTENSIONS }
                ?.sortedBy { it.name.lowercase() }
                ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Resolves a file name to a real file inside [FOLDER_PATH].
     * Returns null for anything that would escape the folder (path traversal, sub-directories).
     */
    fun resolve(name: String): File? {
        if (name.isBlank() || name.length > 255) return null
        if (name.contains('/') || name.contains('\\') || name.contains("..")) return null
        val dir = folder()
        val file = File(dir, name)
        if (!file.isFile) return null
        return try {
            val dirPath = dir.canonicalPath + File.separator
            if (file.canonicalPath.startsWith(dirPath)) file else null
        } catch (_: Exception) {
            null
        }
    }
}
