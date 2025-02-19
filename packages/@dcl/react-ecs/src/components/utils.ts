import { EntityPropTypes } from './types'
import { parseUiBackground } from './uiBackground'
import { parseUiTransform } from './uiTransform'

/**
 * @internal
 */
export function parseProps(props: EntityPropTypes) {
  const { uiTransform, uiBackground, ...otherProps } = props
  const uiTransformProps = parseUiTransform(uiTransform)
  const uiBackgroundProps = uiBackground ? { uiBackground: parseUiBackground(uiBackground) } : undefined
  return {
    ...otherProps,
    uiTransform: uiTransformProps,
    ...uiBackgroundProps
  }
}
