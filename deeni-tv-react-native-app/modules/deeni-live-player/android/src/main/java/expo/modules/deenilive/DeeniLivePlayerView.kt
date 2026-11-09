package expo.modules.deenilive

import android.content.Context
import android.graphics.Color
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** Shows LivePlayerHost's WebView (one per app; this view only borrows it). Never takes focus. */
class DeeniLivePlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  init {
    isFocusable = false
    descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    setBackgroundColor(Color.BLACK)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    LivePlayerHost.adopt(this, appContext.currentActivity)
  }

  fun releasePlayer() {
    LivePlayerHost.release(this, appContext.currentActivity)
  }
}
