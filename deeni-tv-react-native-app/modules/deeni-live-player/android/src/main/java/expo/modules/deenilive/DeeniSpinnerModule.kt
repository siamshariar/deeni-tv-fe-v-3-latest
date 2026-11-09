package expo.modules.deenilive

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The TV's loading ring (res/drawable/deeni_spinner.xml). */
class DeeniSpinnerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeeniSpinner")

    View(DeeniSpinnerView::class) {}
  }
}
