import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  InputAction,
  pointerEventsSystem,
  Raycast,
  RaycastQueryType,
  RaycastResult
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

function createCube(x: number, y: number, z: number, scaleMultiplier: number = 1) {
  const cubeEntity = engine.addEntity()

  Transform.create(cubeEntity, {
    position: { x, y, z },
    scale: { x: scaleMultiplier, y: scaleMultiplier, z: scaleMultiplier }
  })

  MeshRenderer.create(cubeEntity, { mesh: { $case: 'box', box: { uvs: [] } } })
  MeshCollider.create(cubeEntity, { mesh: { $case: 'box', box: {} } })

  return cubeEntity
}

// Create cube to hit
const cubeEntity = createCube(8, 1, 8)
const _cubeEntity2 = createCube(8, 1, 13)
const raycastEntity = engine.addEntity()

// Add OnPointerDown component to cube entity to trigger ray casting on interaction
pointerEventsSystem.onPointerDown(
  cubeEntity,
  () => {
    Raycast.createOrReplace(raycastEntity, {
      direction: {
        $case: 'localDirection',
        localDirection: Vector3.Forward()
      },
      maxDistance: 16,
      queryType: RaycastQueryType.RQT_QUERY_ALL
    })
  },
  {
    button: InputAction.IA_POINTER,
    hoverText: 'CAST RAY'
  }
)

// System to detect new raycast responses and instantiate a cube where the ray hits
let lastRaycastTimestamp = -1
engine.addSystem(() => {
  for (const [_entity, result] of engine.getEntitiesWith(RaycastResult)) {
    const timestamp = result.timestamp ?? 0
    if (result.hits?.length === 0 || timestamp <= lastRaycastTimestamp) continue
    lastRaycastTimestamp = timestamp

    if (result.hits[0] && result.hits[0].position) {
      createCube(result.hits[0].position.x, result.hits[0].position.y, result.hits[0].position.z, 0.3)
    }

    console.log(`Hits (this should be '2' the first time): '${result.hits.length}'`)
  }
})

export {}
