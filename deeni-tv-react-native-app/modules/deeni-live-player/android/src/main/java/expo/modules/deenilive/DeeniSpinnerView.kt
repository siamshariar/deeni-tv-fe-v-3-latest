package expo.modules.deenilive

import android.content.Context
import android.graphics.drawable.Animatable
import android.widget.ImageView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class DeeniSpinnerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val image = ImageView(context).apply {
    setImageResource(R.drawable.deeni_spinner)
    scaleType = ImageView.ScaleType.FIT_CENTER
    isFocusable = false
  }

  init {
    isFocusable = false
    addView(image, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    (image.drawable as? Animatable)?.start()
  }

  override fun onDetachedFromWindow() {
    (image.drawable as? Animatable)?.stop()
    super.onDetachedFromWindow()
  }
}
