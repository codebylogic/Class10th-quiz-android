import groovy.json.JsonSlurper

plugins {
    alias(libs.plugins.android.application)
    // AGP 9 ships built-in Kotlin, so the Kotlin Android Gradle plugin must NOT be applied.
}

android {
    namespace = "com.smartquiz.portal"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.smartquiz.portal"
        minSdk = 24
        targetSdk = 35
        versionCode = 8
        versionName = "1.6.0"

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        getByName("debug") {
            // Preferred: a FIXED keystore supplied by CI through secrets. Because the signing
            // certificate stays the same across builds, a newly built APK installs straight
            // over the previous one (and the in-app updater can replace the app in place).
            val fixedKeystorePath = System.getenv("SIGNING_KEYSTORE_PATH")
            if (!fixedKeystorePath.isNullOrBlank() && rootProject.file(fixedKeystorePath).exists()) {
                storeFile = rootProject.file(fixedKeystorePath)
                storePassword = System.getenv("SIGNING_STORE_PASSWORD")
                keyAlias = System.getenv("SIGNING_KEY_ALIAS")
                keyPassword = System.getenv("SIGNING_KEY_PASSWORD")
                storeType = "PKCS12"
            } else {
                // Fallback: a generated ./debug.keystore (its key changes on every fresh CI run)
                val rootDebugKeystore = rootProject.file("debug.keystore")
                if (rootDebugKeystore.exists()) {
                    storeFile = rootDebugKeystore
                    storePassword = "android"
                    keyAlias = "androiddebugkey"
                    keyPassword = "android"
                }
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    // The Kotlin compiler target block was removed: with AGP 9 built-in Kotlin the
    // jvmTarget defaults to compileOptions.targetCompatibility (17 above).

    androidResources {
        noCompress += listOf("woff2", "ttf", "otf", "m4a", "webm")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.kotlinx.coroutines.android)
}

/**
 * PRD Section 11 — Build-time Content Validator
 */
tasks.register("validateQuizContent") {
    group = "verification"
    description = "Validates catalog.json and all chapter JSON files under src/main/assets/web/"

    doLast {
        val webRoot = file("src/main/assets/web")
        val catalogFile = File(webRoot, "catalog.json")
        if (!catalogFile.exists()) {
            throw GradleException("Missing catalog.json at ${catalogFile.absolutePath}")
        }

        val slurper = JsonSlurper()
        val catalog = try {
            @Suppress("UNCHECKED_CAST")
            slurper.parse(catalogFile) as Map<String, Any?>
        } catch (e: Exception) {
            throw GradleException("Invalid JSON in catalog.json: ${e.message}", e)
        }

        val seenChapterIds = mutableSetOf<String>()
        val courses = (catalog["courses"] as? List<*>) ?: emptyList<Any?>()
        if (courses.isEmpty()) {
            throw GradleException("catalog.json must contain a non-empty 'courses' array.")
        }

        fun resolveChapterPath(baseDir: String, fileRel: String): File {
            val normalizedPath = if (fileRel.startsWith("COMMON/")) {
                "data/$fileRel"
            } else if (fileRel.startsWith("data/")) {
                fileRel
            } else {
                val cleanBase = if (baseDir.endsWith("/")) baseDir else "$baseDir/"
                "$cleanBase$fileRel"
            }
            return File(webRoot, normalizedPath)
        }

        fun validateChapterEntry(courseId: String, baseDir: String, chapterMap: Map<*, *>) {
            val chapId = (chapterMap["id"] as? String) ?: "$courseId:${chapterMap["file"]}"
            if (!seenChapterIds.add(chapId)) {
                throw GradleException("Duplicate chapter id detected in catalog.json: $chapId")
            }
            val fileRel = (chapterMap["file"] as? String)
                ?: throw GradleException("Chapter '$chapId' is missing 'file' attribute.")
            val targetFile = resolveChapterPath(baseDir, fileRel)
            if (!targetFile.exists()) {
                throw GradleException("Catalogue path does not exist in assets: ${targetFile.relativeTo(webRoot)} (chapter '$chapId')")
            }
        }

        for (courseObj in courses) {
            val course = courseObj as Map<*, *>
            val courseId = course["id"]?.toString() ?: "unknown"
            val baseDir = course["baseDir"]?.toString() ?: ""
            val subjects = (course["subjects"] as? List<*>) ?: emptyList<Any?>()
            for (subjObj in subjects) {
                val subj = subjObj as Map<*, *>
                val directChapters = (subj["chapters"] as? List<*>) ?: emptyList<Any?>()
                for (ch in directChapters) {
                    validateChapterEntry(courseId, baseDir, ch as Map<*, *>)
                }
                val sections = (subj["sections"] as? List<*>) ?: emptyList<Any?>()
                for (secObj in sections) {
                    val sec = secObj as Map<*, *>
                    val secChapters = (sec["chapters"] as? List<*>) ?: emptyList<Any?>()
                    for (ch in secChapters) {
                        validateChapterEntry(courseId, baseDir, ch as Map<*, *>)
                    }
                }
            }
        }

        val dataDir = File(webRoot, "data")
        val jsonFiles = dataDir.walkTopDown().filter { it.isFile && it.extension == "json" }.toList()
        if (jsonFiles.isEmpty()) {
            throw GradleException("No chapter JSON files found in ${dataDir.absolutePath}")
        }

        for (jf in jsonFiles) {
            val parsed = try {
                @Suppress("UNCHECKED_CAST")
                slurper.parse(jf) as Map<String, Any?>
            } catch (e: Exception) {
                throw GradleException("Invalid JSON in ${jf.relativeTo(webRoot)}: ${e.message}", e)
            }

            for (reqField in listOf("title", "subtitle", "description")) {
                val v = parsed[reqField] as? String
                if (v.isNullOrBlank()) {
                    throw GradleException("Missing or blank '$reqField' in ${jf.relativeTo(webRoot)}")
                }
            }

            val questions = (parsed["questions"] as? List<*>)
            if (questions.isNullOrEmpty()) {
                throw GradleException("Empty or missing 'questions' array in ${jf.relativeTo(webRoot)}")
            }

            questions.forEachIndexed { idx, qObj ->
                val qMap = qObj as? Map<*, *>
                    ?: throw GradleException("Question #$idx is not an object in ${jf.relativeTo(webRoot)}")
                val qText = qMap["q"]
                if (qText == null) {
                    throw GradleException("Question #$idx missing 'q' in ${jf.relativeTo(webRoot)}")
                }
                val options = qMap["o"] as? List<*>
                if (options == null || options.size !in 2..6) {
                    throw GradleException("Question #$idx must have 2..6 options in ${jf.relativeTo(webRoot)}")
                }
                val ansIdx = (qMap["a"] as? Number)?.toInt()
                if (ansIdx == null || ansIdx !in options.indices) {
                    throw GradleException("Question #$idx has out-of-range 'a' index ($ansIdx) in ${jf.relativeTo(webRoot)}")
                }
            }
        }

        println("✓ validateQuizContent passed: ${seenChapterIds.size} catalogue chapters and ${jsonFiles.size} JSON files verified.")
    }
}

tasks.named("preBuild") {
    dependsOn("validateQuizContent")
}
