# Keep @JavascriptInterface methods on NativeBridge for WebView communication
-keepattributes JavascriptInterface
-keepattributes *Annotation*

-keepclassmembers class com.smartquiz.portal.web.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
