import mitt from 'mitt'
import { GizmoManager, IAxisDragGizmo, Quaternion, Vector3 } from '@babylonjs/core'
import { EcsEntity } from './EcsEntity'
import { Entity, TransformType } from '@dcl/ecs'
import { getLayoutManager } from './layout-manager'
import { inBounds } from '../../utils/layout'
import { snapManager, snapPosition, snapRotation, snapScale } from './snap-manager'
import { SceneContext } from './SceneContext'
import { GizmoType } from '../../utils/gizmo'

function areProportional(a: number, b: number) {
  // this leeway is here to account for rounding errors due to serializing/deserializing floating point numbers
  return Math.abs(a - b) < 1e-5
}

export function createGizmoManager(context: SceneContext) {
  // events
  const events = mitt<{ change: void }>()

  // Create and initialize gizmo
  const gizmoManager = new GizmoManager(context.scene)
  gizmoManager.usePointerToAttachGizmos = false
  gizmoManager.positionGizmoEnabled = true
  gizmoManager.rotationGizmoEnabled = true
  gizmoManager.scaleGizmoEnabled = true
  gizmoManager.positionGizmoEnabled = false
  gizmoManager.rotationGizmoEnabled = false
  gizmoManager.scaleGizmoEnabled = false
  gizmoManager.gizmos.positionGizmo!.updateGizmoRotationToMatchAttachedMesh = false
  gizmoManager.gizmos.rotationGizmo!.updateGizmoRotationToMatchAttachedMesh = true

  const layoutManager = getLayoutManager(context.scene)

  function dragBehavior(gizmo: IAxisDragGizmo) {
    gizmo.dragBehavior.validateDrag = function validateDrag(targetPosition: Vector3) {
      const yIsInBounds = targetPosition.y >= 0 || (!!lastEntity && lastEntity.position.y < targetPosition.y)
      const layout = layoutManager.getLayout()
      const isAlreadyOutOfBounds = !!lastEntity && !inBounds(layout, lastEntity?.position)
      const xzIsInBounds = inBounds(layout, targetPosition)
      // Allow drag if target position is within bounds, or if the gizmo is already out of bounds (it can get there by modifiying the transform values manually)
      return (yIsInBounds && xzIsInBounds) || isAlreadyOutOfBounds
    }
  }

  dragBehavior(gizmoManager.gizmos.positionGizmo!.xGizmo)
  dragBehavior(gizmoManager.gizmos.positionGizmo!.yGizmo)
  dragBehavior(gizmoManager.gizmos.positionGizmo!.zGizmo)

  let lastEntity: EcsEntity | null = null
  let rotationGizmoAlignmentDisabled = false
  let shouldRestorRotationGizmoAlignment = false

  function fixRotationGizmoAlignment(value: TransformType) {
    const isProportional =
      areProportional(value.scale.x, value.scale.y) && areProportional(value.scale.y, value.scale.z)
    rotationGizmoAlignmentDisabled = !isProportional
    if (!isProportional && !isRotationGizmoWorldAligned()) {
      setRotationGizmoWorldAligned(true) // set to world
      shouldRestorRotationGizmoAlignment = true
    } else if (shouldRestorRotationGizmoAlignment && isProportional) {
      setRotationGizmoWorldAligned(false) // restore to local
      shouldRestorRotationGizmoAlignment = false
    } else {
      events.emit('change')
    }
  }

  function getTransform(): TransformType {
    if (lastEntity) {
      const parent = context.Transform.getOrNull(lastEntity.entityId)?.parent || (0 as Entity)
      const value = {
        position: snapPosition(lastEntity.position),
        scale: snapScale(lastEntity.scaling),
        rotation: lastEntity.rotationQuaternion ? snapRotation(lastEntity.rotationQuaternion) : Quaternion.Zero(),
        parent
      }
      return value
    } else {
      throw new Error('No entity selected')
    }
  }

  function update() {
    if (lastEntity) {
      const transform = getTransform()
      fixRotationGizmoAlignment(transform)
      context.operations.updateValue(context.Transform, lastEntity.entityId, transform)
      void context.operations.dispatch()
    }
  }

  gizmoManager.gizmos.scaleGizmo?.onDragEndObservable.add(update)
  gizmoManager.gizmos.positionGizmo?.onDragEndObservable.add(update)
  gizmoManager.gizmos.rotationGizmo?.onDragEndObservable.add(update)

  // snap
  function updateSnap() {
    gizmoManager.gizmos.positionGizmo!.snapDistance = snapManager.isEnabled() ? snapManager.getPositionSnap() : 0
    gizmoManager.gizmos.scaleGizmo!.snapDistance = snapManager.isEnabled() ? snapManager.getScaleSnap() : 0
    gizmoManager.gizmos.rotationGizmo!.snapDistance = snapManager.isEnabled() ? snapManager.getRotationSnap() : 0
  }
  snapManager.onChange(updateSnap)
  updateSnap()

  function isPositionGizmoWorldAligned() {
    return !gizmoManager.gizmos.positionGizmo!.updateGizmoRotationToMatchAttachedMesh
  }
  function setPositionGizmoWorldAligned(worldAligned: boolean) {
    gizmoManager.gizmos.positionGizmo!.updateGizmoRotationToMatchAttachedMesh = !worldAligned
    events.emit('change')
  }
  function isRotationGizmoWorldAligned() {
    return !gizmoManager.gizmos.rotationGizmo!.updateGizmoRotationToMatchAttachedMesh
  }
  function setRotationGizmoWorldAligned(worldAligned: boolean) {
    gizmoManager.gizmos.rotationGizmo!.updateGizmoRotationToMatchAttachedMesh = !worldAligned
    events.emit('change')
  }

  function isRotationGizmoAlignmentDisabled() {
    return rotationGizmoAlignmentDisabled
  }

  function safeSetRotationGizmoWorldAligned(worldAligned: boolean) {
    if (!isRotationGizmoAlignmentDisabled()) {
      setRotationGizmoWorldAligned(worldAligned)
    }
  }

  function onChange(cb: () => void) {
    events.on('change', cb)
    return () => events.off('change', cb)
  }

  return {
    gizmoManager,
    setEntity(entity: EcsEntity | null) {
      if (entity === lastEntity) return
      gizmoManager.attachToNode(entity)
      lastEntity = entity
      // fix gizmo rotation if necessary
      const transform = getTransform()
      fixRotationGizmoAlignment(transform)
      events.emit('change')
    },
    getEntity() {
      return lastEntity
    },
    unsetEntity() {
      lastEntity = null
      gizmoManager.attachToNode(lastEntity)
      gizmoManager.positionGizmoEnabled = false
      gizmoManager.rotationGizmoEnabled = false
      gizmoManager.scaleGizmoEnabled = false
      events.emit('change')
    },
    getGizmoTypes() {
      return [GizmoType.POSITION, GizmoType.ROTATION, GizmoType.SCALE] as const
    },
    setGizmoType(type: GizmoType) {
      gizmoManager.positionGizmoEnabled = type === GizmoType.POSITION
      gizmoManager.rotationGizmoEnabled = type === GizmoType.ROTATION
      gizmoManager.scaleGizmoEnabled = type === GizmoType.SCALE
      events.emit('change')
    },
    isPositionGizmoWorldAligned,
    setPositionGizmoWorldAligned,
    isRotationGizmoWorldAligned,
    setRotationGizmoWorldAligned: safeSetRotationGizmoWorldAligned,
    fixRotationGizmoAlignment,
    isRotationGizmoAlignmentDisabled,
    onChange
  }
}

export type Gizmos = ReturnType<typeof createGizmoManager>
