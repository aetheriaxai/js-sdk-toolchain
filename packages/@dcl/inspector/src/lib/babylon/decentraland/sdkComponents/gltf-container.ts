import * as BABYLON from '@babylonjs/core'
import { GLTFFileLoader, GLTFLoaderAnimationStartMode } from '@babylonjs/loaders'
import { GLTFLoader } from '@babylonjs/loaders/glTF/2.0'
import { ComponentType, PBGltfContainer } from '@dcl/ecs'
import { markAsCollider } from '../colliders-utils'
import type { ComponentOperation } from '../component-operations'
import { EcsEntity } from '../EcsEntity'
import { SceneContext } from '../SceneContext'

const sceneContextMap = new Map<string /*sceneId*/, WeakRef<SceneContext>>()

BABYLON.SceneLoader.OnPluginActivatedObservable.add(function (plugin) {
  if (plugin instanceof GLTFFileLoader) {
    plugin.animationStartMode = GLTFLoaderAnimationStartMode.NONE
    plugin.compileMaterials = true
    plugin.validate = false
    plugin.createInstances = true
    plugin.animationStartMode = 0
    plugin.preprocessUrlAsync = async function (url: string) {
      // HERE BE DRAGONS 🐉:
      //  To hack the GLTF loader to use Decentraland's file system, we must
      //  access private properties to get the parent context to resolve individual
      //  files.
      //
      //  This Hack prevents the engine from caching the entire GLB/GLTF because
      //  query parameters are added to them. it is RECOMMENDED that the engine
      //  caches all the files by their name (CIDv1)
      const loader: GLTFLoader = (plugin as any)._loader
      const file: string = (loader as any)._fileName
      const [_gltfFilename, strParams] = file.split('?')
      if (strParams) {
        const params = new URLSearchParams(strParams)
        const base = params.get('base') || ''
        const sceneId = params.get('sceneId')!
        const ctx = sceneContextMap.get(sceneId)?.deref()
        if (ctx) {
          const filePath = base + '/' + url
          console.log(`Fetching ${filePath}`)
          const content = await ctx.getFile(filePath)
          if (content) {
            // TODO: this works with File, but it doesn't match the types (it requires string)
            return new File([content], _gltfFilename) as any
          }
        }
      }
      throw new Error('Cannot resolve file ' + url)
    }
  }
})

export const putGltfContainerComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    const newValue = component.getOrNull(entity.entityId) as PBGltfContainer | null
    const currentValue = entity.ecsComponentValues.gltfContainer
    entity.ecsComponentValues.gltfContainer = newValue || undefined

    // for simplicity of the example, we will remove the Gltf on every update.
    if (currentValue?.src !== newValue?.src) {
      removeCurrentGltf(entity)

      if (newValue?.src) {
        const context = entity.context.deref()
        if (!context) return

        // store a WeakRef to the sceneContext to enable file resolver
        sceneContextMap.set(context.loadableScene.id, entity.context)

        tryLoadGltfAsync(context.loadableScene.id, entity, newValue.src).catch((err) => {
          console.error('Error trying to load gltf ' + newValue.src, err)
        })
      }
    }
  }
}

async function tryLoadGltfAsync(sceneId: string, entity: EcsEntity, filePath: string) {
  const content = await entity.context.deref()!.getFile(filePath)
  if (!content) {
    return
  }

  const contextStillAlive = sceneContextMap.get(sceneId)?.deref()
  if (!contextStillAlive) {
    return
  }

  const base = filePath.split('/').slice(0, -1).join('/')
  const finalSrc = filePath + '?sceneId=' + encodeURIComponent(sceneId) + '&base=' + encodeURIComponent(base)

  const file = new File([content], finalSrc)
  const extension = filePath.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb'

  BABYLON.SceneLoader.LoadAssetContainer(
    '',
    file,
    entity.getScene(),
    (assetContainer) => {
      processGLTFAssetContainer(assetContainer, entity)

      // Fin the main mesh and add it as the BasicShape.nameInEntity component.
      assetContainer.meshes
        .filter(($) => $.name === '__root__')
        .forEach((mesh) => {
          mesh.parent = entity
          entity.gltfContainer = mesh
        })

      entity.gltfAssetContainer = assetContainer
    },
    null,
    (_scene, _message, _exception) => {
      console.error('Error while calling LoadAssetContainer: ', _message, _exception)
      // debugger
      // const animator: Animator = entity.getBehaviorByName('animator') as Animator

      // if (animator) {
      //   animator.transformValue(animator.value!)
      // }
    },
    extension
  )
}

function removeCurrentGltf(entity: EcsEntity) {
  if (entity.gltfContainer) {
    entity.gltfContainer.setEnabled(false)
    entity.gltfContainer.parent = null
    entity.gltfContainer.dispose(false, true)
    delete entity.gltfContainer
  }
}

export function processGLTFAssetContainer(assetContainer: BABYLON.AssetContainer, entity: EcsEntity) {
  assetContainer.meshes.forEach((mesh) => {
    if (mesh instanceof BABYLON.Mesh) {
      if (mesh.geometry && !assetContainer.geometries.includes(mesh.geometry)) {
        assetContainer.geometries.push(mesh.geometry)
      }
      if (mesh.material instanceof BABYLON.Material) {
        mesh.material.alphaMode = 0
      }
    }
    mesh.subMeshes &&
      mesh.subMeshes.forEach((subMesh) => {
        const mesh = subMesh.getMesh()
        if (mesh instanceof BABYLON.Mesh) {
          if (mesh.geometry && !assetContainer.geometries.includes(mesh.geometry)) {
            assetContainer.geometries.push(mesh.geometry)
          }
        }
      })
  })

  processColliders(assetContainer, entity)

  // Find all the materials from all the meshes and add to $.materials
  assetContainer.meshes.forEach((mesh) => {
    mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY
    if (mesh.material) {
      if (!assetContainer.materials.includes(mesh.material)) {
        assetContainer.materials.push(mesh.material)
      }
    }
  })

  // Find the textures in the materials that share the same domain as the context
  // then add the textures to the $.textures
  assetContainer.materials.forEach((material: BABYLON.Material | BABYLON.PBRMaterial) => {
    for (const i in material) {
      const t = (material as any)[i]

      if (i.endsWith('Texture') && t instanceof BABYLON.Texture) {
        if (!assetContainer.textures.includes(t)) {
          // if (isSceneTexture(t)) {
          assetContainer.textures.push(t)
          // }
        }
      }
    }

    if ('albedoTexture' in material) {
      if (material.alphaMode === 2) {
        if (material.albedoTexture) {
          material.albedoTexture.hasAlpha = true
          material.useAlphaFromAlbedoTexture = true
        }
      }
    }
  })

  for (const ag of assetContainer.animationGroups) {
    ag.stop()
    for (const animatable of ag.animatables) {
      animatable.weight = 0
    }
  }

  assetContainer.addAllToScene()
}

// eslint-disable-next-line @typescript-eslint/ban-types
function disposeDelegate($: { dispose: Function }) {
  $.dispose()
}

function disposeNodeDelegate($: BABYLON.Node | null) {
  if (!$) return
  $.setEnabled(false)
  $.parent = null
  $.dispose(false)
}

function disposeSkeleton($: BABYLON.Skeleton) {
  $.dispose()
  $.bones.forEach(($) => {
    $.parent = null
    $.dispose()
  })
}

function disposeAnimatable($: BABYLON.Animatable | null) {
  if (!$) return
  $.disposeOnEnd = true
  $.loopAnimation = false
  $.stop()
  $._animate(0)
}

export function disposeAnimationGroups(scene: BABYLON.Scene, $: BABYLON.AnimationGroup) {
  $.animatables.forEach(disposeAnimatable)

  $.targetedAnimations.forEach(($) => {
    disposeAnimatable(scene.getAnimatableByTarget($.target))
  })

  $.dispose()
}

export function cleanupAssetContainer(scene: BABYLON.Scene, $: BABYLON.AssetContainer) {
  if ($) {
    $.removeAllFromScene()
    $.transformNodes && $.transformNodes.forEach(disposeNodeDelegate)
    $.rootNodes && $.rootNodes.forEach(disposeNodeDelegate)
    $.meshes && $.meshes.forEach(disposeNodeDelegate)
    // Textures disposals are handled by monkeyLoader.ts
    // NOTE: $.textures && $.textures.forEach(disposeDelegate)
    $.animationGroups && $.animationGroups.forEach(($) => disposeAnimationGroups(scene, $))
    $.multiMaterials && $.multiMaterials.forEach(disposeDelegate)
    $.sounds && $.sounds.forEach(disposeDelegate)
    $.skeletons && $.skeletons.forEach(disposeSkeleton)
    $.materials && $.materials.forEach(disposeDelegate)
    $.lights && $.lights.forEach(disposeDelegate)
  }
}

function processColliders($: BABYLON.AssetContainer, _entity: EcsEntity) {
  for (let i = 0; i < $.meshes.length; i++) {
    const mesh = $.meshes[i]

    if (mesh.name.toLowerCase().endsWith('collider')) {
      mesh.checkCollisions = true
      mesh.visibility = 0
      mesh.isPickable = false
      markAsCollider(mesh)
    } else {
      mesh.isPickable = true
    }
  }
}
