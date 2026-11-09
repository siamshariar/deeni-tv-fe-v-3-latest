package expo.modules.deenilive

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.MutableContextWrapper
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.io.File

/**
 * The live player's WebView, started when the app launches instead of when React Native first
 * draws (TV; React Native's JS decides, see src/components/player/NativeLivePlayer.tsx).
 *
 * On the TV box React Native needs ~7 s before its first WebView exists; YouTube's player then
 * takes ~5–6 s to start and ~9 s to load a video (2026-11-04). Here the page the previous run
 * cached loads during React Native's start, and starts the programme the cached schedule names
 * for now, so React Native finds YouTube loading or playing it.
 *
 * It behaves like react-native-webview's WebView for the page: commands are JS run in the page,
 * and the page's messages leave through `window.ReactNativeWebView.postMessage`. Messages from
 * before React Native listens are kept, in order, until it takes them (takeMessages).
 */
object LivePlayerHost {
  private const val TAG = "DeeniLivePlayer"
  private const val PAGE_FILE = "deeni-live-page.html"
  private const val META_FILE = "deeni-live-page.json"
  private const val INITIAL_FILE = "deeni-live-initial.json"

  /** The page's placeholder for the cached schedule (src/lib/youtube/playerPage.ts). */
  private const val INITIAL_MARK = "/*DEENI_INITIAL*/null"
  private const val MAX_BUFFER = 300

  private data class Page(val template: String, val baseUrl: String, val version: String)

  private val main = Handler(Looper.getMainLooper())
  private val lock = Any()
  private val buffer = ArrayList<String>()
  private var forwarding = false

  private var app: Context? = null
  private var wrapper: MutableContextWrapper? = null
  private var page: Page? = null
  private var host: ViewGroup? = null

  @Volatile
  private var webView: WebView? = null

  @Volatile
  var onMessage: ((String) -> Unit)? = null
  var onProcessGone: (() -> Unit)? = null

  val hasWebView: Boolean
    get() = webView != null

  // ── App lifecycle (main thread) ─────────────────────────────────────────

  /** The activity exists: start the cached page and attach it to the window, so it runs as a visible page. */
  fun onActivityCreated(activity: Activity) {
    app = activity.applicationContext
    if (webView == null) {
      val cached = readPage(activity.applicationContext) ?: return
      try {
        page = cached
        create(activity.applicationContext)
        load(cached)
      } catch (e: Throwable) {
        Log.w(TAG, "start at launch failed", e)
        destroyView()
        return
      }
    }
    val view = webView ?: return
    wrapper?.baseContext = activity
    if (view.parent == null) attachBehind(activity, view)
  }

  fun onActivityResumed() {
    webView?.onResume()
  }

  /** react-native-webview pauses its WebViews with the app too. */
  fun onActivityPaused() {
    webView?.onPause()
  }

  fun onActivityDestroyed(activity: Activity) {
    val view = webView ?: return
    val decor = activity.window?.decorView
    if (view.rootView === decor || host?.rootView === decor) {
      (view.parent as? ViewGroup)?.removeView(view)
      host = null
    }
    app?.let { wrapper?.baseContext = it }
  }

  // ── The React Native view ───────────────────────────────────────────────

  /** The view showing the player: it gets the WebView (created now if the app had no cached page). */
  fun adopt(target: ViewGroup, activity: Activity?) {
    main.post {
      if (webView == null) {
        val context = (activity ?: target.context).applicationContext
        app = context
        create(context)
        page?.let { load(it) }
      }
      activity?.let { wrapper?.baseContext = it }
      val view = webView ?: return@post
      host = target
      if (view.parent === target) return@post
      (view.parent as? ViewGroup)?.removeView(view)
      target.addView(view, 0, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }
  }

  /** The view went away: keep the page attached to the window (still running) until the next one. */
  fun release(target: ViewGroup, activity: Activity?) {
    main.post {
      if (host !== target) return@post
      host = null
      val view = webView ?: return@post
      if (view.parent === target) target.removeView(view)
      if (activity != null && !activity.isFinishing && !activity.isDestroyed) attachBehind(activity, view)
    }
  }

  // ── React Native's calls ────────────────────────────────────────────────

  /**
   * The page React Native wants (main thread). The same version as the one running is kept
   * ("kept"); another one is loaded and cached for the next launch ("loaded").
   */
  fun setPage(context: Context, template: String, baseUrl: String, version: String): String {
    val appContext = context.applicationContext
    app = appContext
    val next = Page(template, baseUrl, version)
    val running = webView != null && page?.version == version
    page = next
    try {
      writePage(appContext, next)
    } catch (e: Throwable) {
      Log.w(TAG, "could not cache the page", e)
    }
    if (running) return "kept"
    synchronized(lock) {
      buffer.clear()
      forwarding = false
    }
    if (webView == null) create(appContext)
    load(next)
    return "loaded"
  }

  /** The schedule the next launch's page starts from (a JSON object, see playerPage.ts). */
  fun saveInitial(context: Context, json: String) {
    try {
      JSONObject(json)
      File(context.applicationContext.filesDir, INITIAL_FILE).writeText(json)
    } catch (e: Throwable) {
      Log.w(TAG, "could not save the launch schedule", e)
    }
  }

  fun inject(js: String) {
    main.post { webView?.evaluateJavascript(js, null) }
  }

  /** Messages kept since the page started, oldest first; later ones go out as events. */
  fun takeMessages(): List<String> {
    synchronized(lock) {
      val out = ArrayList(buffer)
      buffer.clear()
      forwarding = true
      return out
    }
  }

  fun stopForwarding() {
    synchronized(lock) { forwarding = false }
  }

  /** Throw the page away and load it again in a new WebView (React Native has reset its engine). */
  fun reload() {
    main.post { recreate() }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private fun deliver(from: WebView, message: String) {
    if (from !== webView) return
    val listener: ((String) -> Unit)?
    synchronized(lock) {
      listener = if (forwarding) onMessage else null
      if (listener == null) {
        buffer.add(message)
        if (buffer.size > MAX_BUFFER) buffer.subList(0, buffer.size - MAX_BUFFER).clear()
        return
      }
    }
    listener?.invoke(message)
  }

  private fun attachBehind(activity: Activity, view: WebView) {
    // Under everything (the decor's first child): drawn but covered until React Native's view takes it.
    val decor = activity.window?.decorView as? ViewGroup ?: return
    decor.addView(view, 0, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  private fun load(p: Page) {
    val initial = readInitial() ?: "null"
    webView?.loadDataWithBaseURL(p.baseUrl, p.template.replace(INITIAL_MARK, initial), "text/html", "UTF-8", null)
  }

  private fun recreate() {
    val old = webView ?: return
    val parent = old.parent as? ViewGroup
    parent?.removeView(old)
    destroyView()
    synchronized(lock) { buffer.clear() }
    val context = app ?: return
    create(context)
    val view = webView ?: return
    parent?.addView(view, 0, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    page?.let { load(it) }
  }

  private fun destroyView() {
    val old = webView ?: return
    webView = null
    try {
      old.destroy()
    } catch (_: Throwable) {
    }
  }

  @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
  private fun create(appContext: Context) {
    val context = wrapper ?: MutableContextWrapper(appContext).also { wrapper = it }
    val view = WebView(context)
    view.setBackgroundColor(Color.BLACK)
    view.isFocusable = false
    view.isFocusableInTouchMode = false
    view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    view.overScrollMode = View.OVER_SCROLL_NEVER
    view.isVerticalScrollBarEnabled = false
    view.isHorizontalScrollBarEnabled = false
    // react-native-webview's settings for the same page (YouTubeWebView.tsx).
    view.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      mediaPlaybackRequiresUserGesture = false
      setSupportMultipleWindows(false)
      builtInZoomControls = false
      displayZoomControls = false
      loadWithOverviewMode = true
      useWideViewPort = true
      allowFileAccess = false
      allowContentAccess = false
      mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
      textZoom = 100
    }
    CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
    view.webViewClient = client
    view.webChromeClient = chromeClient
    view.addJavascriptInterface(Bridge(view), "ReactNativeWebView")
    webView = view
  }

  private class Bridge(private val owner: WebView) {
    @JavascriptInterface
    fun postMessage(message: String?) {
      if (message != null) LivePlayerHost.deliver(owner, message)
    }
  }

  private val client = object : WebViewClient() {
    // Only the inline page loads in the top frame (YouTubeWebView's onShouldStartLoadWithRequest).
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      if (!request.isForMainFrame) return false
      val url = request.url.toString()
      val origin = page?.baseUrl?.trimEnd('/') ?: return true
      return !(url == "about:blank" || url.startsWith(origin))
    }

    @RequiresApi(Build.VERSION_CODES.O)
    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
      Log.w(TAG, "render process gone (crash: ${detail.didCrash()}), rebuilding the page")
      if (view === webView) {
        main.post {
          onProcessGone?.invoke()
          recreate()
        }
      }
      return true
    }
  }

  private val chromeClient = object : WebChromeClient() {
    // No grey "play" poster before the first frame.
    override fun getDefaultVideoPoster(): Bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)

    override fun onConsoleMessage(message: ConsoleMessage): Boolean = true
  }

  private fun readPage(context: Context): Page? {
    return try {
      val dir = context.filesDir
      val html = File(dir, PAGE_FILE).takeIf { it.exists() }?.readText() ?: return null
      val meta = JSONObject(File(dir, META_FILE).readText())
      Page(html, meta.getString("baseUrl"), meta.getString("version"))
    } catch (_: Throwable) {
      null
    }
  }

  private fun writePage(context: Context, p: Page) {
    val dir = context.filesDir
    if (readPage(context)?.version == p.version) return
    File(dir, PAGE_FILE).writeText(p.template)
    File(dir, META_FILE).writeText(JSONObject().put("baseUrl", p.baseUrl).put("version", p.version).toString())
  }

  private fun readInitial(): String? {
    val context = app ?: return null
    return try {
      val text = File(context.filesDir, INITIAL_FILE).takeIf { it.exists() }?.readText() ?: return null
      JSONObject(text)
      text
    } catch (_: Throwable) {
      null
    }
  }
}
