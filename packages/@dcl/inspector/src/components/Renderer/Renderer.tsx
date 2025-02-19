import React, { useState } from 'react'
import { useDrop } from 'react-dnd'
import { Vector3 } from '@babylonjs/core'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Dimmer } from 'decentraland-ui/dist/components/Dimmer/Dimmer'

import { BuilderAsset, DROP_TYPES, IDrop, ProjectAssetDrop, isDropType } from '../../lib/sdk/drag-drop'
import { useRenderer } from '../../hooks/sdk/useRenderer'
import { useSdk } from '../../hooks/sdk/useSdk'
import { getPointerCoords } from '../../lib/babylon/decentraland/mouse-utils'
import { snapPosition } from '../../lib/babylon/decentraland/snap-manager'
import { ROOT } from '../../lib/sdk/tree'
import { AssetNodeItem } from '../ProjectAssetExplorer/types'
import { IAsset } from '../AssetsCatalog/types'
import { getModel, isAsset } from '../EntityInspector/GltfInspector/utils'
import { useIsMounted } from '../../hooks/useIsMounted'
import { Warnings } from './Warnings'

import './Renderer.css'

const fixedNumber = (val: number) => Math.round(val * 1e2) / 1e2

const Renderer: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  useRenderer(() => canvasRef)
  const sdk = useSdk()
  const [isLoading, setIsLoading] = useState(false)
  const isMounted = useIsMounted()

  const getDropPosition = async () => {
    const pointerCoords = await getPointerCoords(sdk!.scene)
    return snapPosition(new Vector3(fixedNumber(pointerCoords.x), 0, fixedNumber(pointerCoords.z)))
  }

  const addAsset = async (asset: AssetNodeItem, position: Vector3) => {
    if (!sdk) return
    const { operations } = sdk
    operations.addAsset(ROOT, asset.asset.src, asset.name, position)
    await operations.dispatch()
  }

  const importBuilderAsset = async (asset: IAsset) => {
    const position = await getDropPosition()
    const fileContent: Record<string, Uint8Array> = {}
    const destFolder = 'world-assets'
    const assetPackageName = asset.name.trim().replaceAll(' ', '_').toLowerCase()
    const path = Object.keys(asset.contents).find(($) => isAsset($))
    setIsLoading(true)
    await Promise.all(
      Object.entries(asset.contents).map(async ([path, contentHash]) => {
        try {
          const url = `https://builder-api.decentraland.org/v1/storage/contents/${contentHash}`
          const content = await (await fetch(url)).arrayBuffer()
          fileContent[path] = new Uint8Array(content)
        } catch (err) {
          console.error('Error fetching an asset import ' + path)
        }
      })
    )
    if (!path) {
      throw new Error('Invalid asset format: should contain at least one gltf/glb file')
    }
    await sdk!.dataLayer.importAsset({
      content: new Map(Object.entries(fileContent)),
      basePath: destFolder,
      assetPackageName
    })
    if (!isMounted()) return
    setIsLoading(false)
    const model: AssetNodeItem = {
      type: 'asset',
      name: asset.name,
      parent: null,
      asset: { type: 'gltf', src: `${destFolder}/${assetPackageName}/${path}` }
    }
    await addAsset(model, position)
  }

  const [, drop] = useDrop(
    () => ({
      accept: DROP_TYPES,
      drop: async (item: IDrop, monitor) => {
        if (monitor.didDrop()) return
        const itemType = monitor.getItemType()

        if (isDropType<BuilderAsset>(item, itemType, 'builder-asset')) {
          void importBuilderAsset(item.value)
          return
        }

        if (isDropType<ProjectAssetDrop>(item, itemType, 'project-asset-gltf')) {
          const node = item.context.tree.get(item.value)!
          const model = getModel(node, item.context.tree)
          if (model) {
            const position = await getDropPosition()
            await addAsset(model, position)
          }
        }
      }
    }),
    [addAsset]
  )

  drop(canvasRef)

  return (
    <div className="Renderer">
      {isLoading && (
        <div className="loading">
          <Loader active />
          <Dimmer active />
        </div>
      )}
      <Warnings />
      <canvas ref={canvasRef} id="canvas" touch-action="none" />
    </div>
  )
}

export default React.memo(Renderer)
