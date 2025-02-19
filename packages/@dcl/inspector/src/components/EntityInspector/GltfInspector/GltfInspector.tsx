import { useCallback } from 'react'
import { Menu, Item } from 'react-contexify'
import { useDrop } from 'react-dnd'
import { AiFillDelete as DeleteIcon } from 'react-icons/ai'
import cx from 'classnames'

import { withContextMenu } from '../../../hoc/withContextMenu'
import { WithSdkProps, withSdk } from '../../../hoc/withSdk'
import { useHasComponent } from '../../../hooks/sdk/useHasComponent'
import { useComponentInput } from '../../../hooks/sdk/useComponentInput'
import { useContextMenu } from '../../../hooks/sdk/useContextMenu'
import { useFileSystem } from '../../../hooks/catalog/useFileSystem'
import { ProjectAssetDrop } from '../../../lib/sdk/drag-drop'
import { Block } from '../../Block'
import { Container } from '../../Container'
import { TextField } from '../TextField'
import { Props } from './types'
import { fromGltf, toGltf, isValidInput, getModel } from './utils'

const DROP_TYPES = ['project-asset-gltf']

export default withSdk<Props>(
  withContextMenu<WithSdkProps & Props>(({ sdk, entity, contextMenuId }) => {
    const [files, init] = useFileSystem()
    const { handleAction } = useContextMenu()
    const { GltfContainer } = sdk.components

    const hasGltf = useHasComponent(entity, GltfContainer)
    const handleInputValidation = useCallback(({ src }: { src: string }) => isValidInput(files, src), [files])
    const { getInputProps, isValid } = useComponentInput(
      entity,
      GltfContainer,
      fromGltf,
      toGltf,
      handleInputValidation,
      [files]
    )

    const handleRemove = useCallback(() => {
      sdk.operations.removeComponent(entity, GltfContainer.componentId)
      sdk.operations.dispatch()
    }, [])
    const handleDrop = useCallback(async (src: string) => {
      const { operations } = sdk
      operations.updateValue(GltfContainer, entity, { src })
      await operations.dispatch()
    }, [])

    const [{ isHover }, drop] = useDrop(
      () => ({
        accept: DROP_TYPES,
        drop: ({ value, context }: ProjectAssetDrop, monitor) => {
          if (monitor.didDrop()) return
          const node = context.tree.get(value)!
          const model = getModel(node, context.tree)
          if (model) void handleDrop(model.asset.src)
        },
        canDrop: ({ value, context }: ProjectAssetDrop) => {
          const node = context.tree.get(value)!
          return !!getModel(node, context.tree)
        },
        collect: (monitor) => ({
          isHover: monitor.canDrop() && monitor.isOver()
        })
      }),
      [files]
    )

    if (!hasGltf) return null

    const inputProps = getInputProps('src')

    return (
      <Container label="Gltf" className={cx('Gltf', { hover: isHover })}>
        <Menu id={contextMenuId}>
          <Item id="delete" onClick={handleAction(handleRemove)}>
            <DeleteIcon /> Delete
          </Item>
        </Menu>
        <Block label="Path" ref={drop} error={init && !isValid}>
          <TextField type="text" {...inputProps} />
        </Block>
      </Container>
    )
  })
)
