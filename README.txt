BUILD FIX — v1.9.1 (one file)
=============================

The Kotlin build failed with:

  e: LocalAssetServer.kt:214:38 Unresolved reference 'FOLDER_PATH'.

Cause: ReelsStore was refactored to auto-detect the reel folder, so the old
`ReelsStore.FOLDER_PATH` constant no longer exists. One line still used it.

Fix: that line now reads the folder actually in use:

  put("folder", ReelsStore.findFolder().absolutePath)

APPLY
  unzip -o Reels_v1.9.2_Fix.zip      (from the repo root)
  git add -A
  git commit -m "Fix Kotlin build error: ReelsStore.FOLDER_PATH"
  git push

Nothing else changes. Version stays 1.9.1.
