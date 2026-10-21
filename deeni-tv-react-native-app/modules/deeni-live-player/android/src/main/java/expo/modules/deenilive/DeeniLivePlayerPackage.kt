package expo.modules.deenilive

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Starts the cached live page with the activity (after React Native has begun loading). */
class DeeniLivePlayerPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
    return listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        LivePlayerHost.onActivityCreated(activity)
      }

      override fun onResume(activity: Activity) {
        LivePlayerHost.onActivityResumed()
      }

      override fun onPause(activity: Activity) {
        LivePlayerHost.onActivityPaused()
      }

      override fun onDestroy(activity: Activity) {
        LivePlayerHost.onActivityDestroyed(activity)
      }
    })
  }
}
