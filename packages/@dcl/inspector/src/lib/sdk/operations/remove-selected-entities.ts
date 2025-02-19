import { IEngine } from '@dcl/ecs'
import { EditorComponentIds, EditorComponents } from '../components'

export function removeSelectedEntities(engine: IEngine) {
  return function removeSelectedEntities() {
    const Selection = engine.getComponent(EditorComponentIds.Selection) as EditorComponents['Selection']
    for (const [entity] of engine.getEntitiesWith(Selection)) {
      Selection.deleteFrom(entity)
    }
  }
}

export default removeSelectedEntities
