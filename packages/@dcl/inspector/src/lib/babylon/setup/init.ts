import * as BABYLON from '@babylonjs/core'
import { initKeyboard } from './input'
import { setupEngine } from './setup'

/* 
  I refactored the piece that uses canvas and window into this file and ignored it from coverage 
  because it's not possible to test it without jsdom, and we can't use jsdom because of the ecs 
*/

export function initRenderer(canvas: HTMLCanvasElement) {
  const engine = new BABYLON.Engine(canvas, true, {
    deterministicLockstep: true,
    lockstepMaxSteps: 4,
    alpha: false,
    antialias: true,
    stencil: true
  })
  const renderer = setupEngine(engine)

  // attach camera control to canvas
  renderer.editorCamera.attachControl(canvas, true)

  // resize renderer when window is resized
  function resize() {
    engine.resize(false)
  }
  window.addEventListener('resize', resize)
  new ResizeObserver(resize).observe(canvas)
  function dispose() {
    engine.dispose()
    if (window) {
      window.removeEventListener('resize', resize)
    }
  }

  // init keyboard
  initKeyboard(canvas, renderer.scene, renderer.editorCamera)

  return { ...renderer, dispose }
}
