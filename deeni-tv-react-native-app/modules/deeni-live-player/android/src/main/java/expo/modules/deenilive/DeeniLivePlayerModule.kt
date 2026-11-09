package expo.modules.deenilive

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** React Native's side of LivePlayerHost (see there). */
class DeeniLivePlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeeniLivePlayer")

    Events("onMessage", "onProcessGone")

    OnCreate {
      LivePlayerHost.onMessage = { data -> sendEvent("onMessage", mapOf("data" to data)) }
      LivePlayerHost.onProcessGone = { sendEvent("onProcessGone", mapOf<String, Any?>()) }
    }

    OnDestroy {
      LivePlayerHost.onMessage = null
      LivePlayerHost.onProcessGone = null
      LivePlayerHost.stopForwarding()
    }

    AsyncFunction("setPage") { html: String, baseUrl: String, version: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      LivePlayerHost.setPage(context, html, baseUrl, version)
    }.runOnQueue(Queues.MAIN)

    Function("setInitial") { json: String ->
      appContext.reactContext?.let { LivePlayerHost.saveInitial(it, json) }
      Unit
    }

    Function("inject") { js: String ->
      LivePlayerHost.inject(js)
    }

    Function("takeMessages") {
      LivePlayerHost.takeMessages()
    }

    Function("reload") {
      LivePlayerHost.reload()
    }

    View(DeeniLivePlayerView::class) {
      OnViewDestroys { view: DeeniLivePlayerView ->
        view.releasePlayer()
      }
    }
  }
}
