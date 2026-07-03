/**
 * Logical game actions. The whole point of routing through an abstract action
 * set is that a PC keyboard, a mouse, and a console gamepad all map onto the
 * SAME actions — so the game logic that consumes them is identical on every
 * platform. Adding a control scheme is a mapping change in an InputSource
 * implementation, never a change in the game.
 */
export enum GameAction {
  /** Possess the ant under the cursor / reticle (or nearest to camera focus
   * on gamepad). */
  Possess = "possess",
  /** Release the currently possessed ant. */
  Release = "release",
  /** Paint a food-trail pheromone at the cursor / reticle. */
  PaintFood = "paintFood",
  /** Paint a home-trail pheromone at the cursor / reticle. */
  PaintHome = "paintHome",
  /** Orbit the camera around its focus. */
  OrbitLeft = "orbitLeft",
  OrbitRight = "orbitRight",
  /** Snap to a perspective preset (Ground / Colony / Ecosystem). */
  PerspGround = "perspGround",
  PerspColony = "perspColony",
  PerspEcosystem = "perspEcosystem",
  ZoomIn = "zoomIn",
  ZoomOut = "zoomOut",
  Pause = "pause",
  /** Toggle the pheromone heat overlay. */
  ToggleOverlay = "toggleOverlay",
  /** Recenter camera on the player nest / possessed ant. */
  Recenter = "recenter",
  Confirm = "confirm",
}
