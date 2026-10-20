package com.smartquiz.portal

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONObject

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "smart_quiz_prefs")

/**
 * PRD Section 6.4, 7.2 & C.8:
 * DataStore for theme, profile language, bilingual display preference, selected course,
 * and optional mirrored progress snapshot so progress and preferences survive WebView cache clears.
 */
class AppPrefs(private val context: Context) {

    companion object {
        private val KEY_THEME = stringPreferencesKey("theme")
        private val KEY_PROFILE_LANG = stringPreferencesKey("profile_lang")
        private val KEY_QUIZ_LANG_PREF = stringPreferencesKey("quiz_lang_pref")
        private val KEY_SELECTED_COURSE = stringPreferencesKey("selected_course")
        private val KEY_PROGRESS_SNAPSHOT = stringPreferencesKey("progress_snapshot_json")
    }

    suspend fun getPreferencesJson(): String {
        val prefs = context.dataStore.data.first()
        return JSONObject().apply {
            put("theme", prefs[KEY_THEME] ?: "dark")
            put("profileLang", prefs[KEY_PROFILE_LANG] ?: "hi")
            put("quizLangPref", prefs[KEY_QUIZ_LANG_PREF] ?: "hi-pri")
            put("selectedCourse", prefs[KEY_SELECTED_COURSE] ?: "bseb10")
        }.toString()
    }

    suspend fun savePreferences(
        theme: String?,
        profileLang: String?,
        quizLangPref: String?,
        selectedCourse: String?
    ) {
        context.dataStore.edit { prefs ->
            if (!theme.isNullOrBlank()) prefs[KEY_THEME] = theme
            if (!profileLang.isNullOrBlank()) prefs[KEY_PROFILE_LANG] = profileLang
            if (!quizLangPref.isNullOrBlank()) prefs[KEY_QUIZ_LANG_PREF] = quizLangPref
            if (!selectedCourse.isNullOrBlank()) prefs[KEY_SELECTED_COURSE] = selectedCourse
        }
    }

    suspend fun saveProgressSnapshot(json: String) {
        context.dataStore.edit { prefs ->
            prefs[KEY_PROGRESS_SNAPSHOT] = json
        }
    }

    suspend fun loadProgressSnapshot(): String {
        return context.dataStore.data.map { it[KEY_PROGRESS_SNAPSHOT] ?: "" }.first()
    }

    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }
}
