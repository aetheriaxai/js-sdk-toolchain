import * as fs from 'fs'
import * as path from 'path'
import { Component } from './generateComponent'
import generateExportedTypes from './generateExportedTypes'

function importComponent(component: Component) {
  return `import { ${component.componentPascalName}Schema } from './${component.componentPascalName}.gen'; import { PB${component.componentPascalName} } from './pb/decentraland/sdk/components/${component.componentFile}.gen'`
}

function importComponentFromIndex(component: Component) {
  return `import { PB${component.componentPascalName} } from './pb/decentraland/sdk/components/${component.componentFile}.gen'`
}

function exportComponent(component: Component) {
  return `export * from './pb/decentraland/sdk/components/${component.componentFile}.gen'`
}

function defineComponentDecl(component: Component) {
  return `/** @public *//*#__PURE__*/ export const ${component.componentPascalName}: ComponentGetter<ComponentDefinition<PB${component.componentPascalName}>> = engine =>
    engine.defineComponentFromSchema("core::${component.componentPascalName}", ${component.componentPascalName}Schema);
  `.trim()
}

const skipExposeGlobally: string[] = [
  'Animator',
  'MeshRenderer',
  'MeshCollider',
  'Material'
]
function defineGlobalComponentDecl(component: Component) {
  if (skipExposeGlobally.includes(component.componentPascalName)) return ''
  return `/** @public *//*#__PURE__*/ export const ${component.componentPascalName}: ComponentDefinition<PB${component.componentPascalName}> = components.${component.componentPascalName}(engine)`.trim()
}

const indexTemplate = `import type { IEngine } from '../../engine/types'
import { ComponentDefinition } from '../../engine/component'
import * as TransformSchema from '../legacy/Transform'
$componentImports
$componentExports

export type ComponentGetter<T extends ComponentDefinition<any>> = (engine: Pick<IEngine,'defineComponentFromSchema'>) => T

$componentDeclarations
`

const globalTemplate = `
import { engine } from '../../runtime/initialization'
import { ComponentDefinition } from '../../engine/component'
import * as components from './index.gen'
export * from './index.gen';

$allGlobalComponentsImports

$allGlobalComponents
`

export function generateIndex(param: {
  components: Component[]
  generatedPath: string
}) {
  const { components, generatedPath } = param
  const componentWithoutIndex = components.filter(
    (component) => component.componentPascalName !== 'index'
  )

  const indexContent = indexTemplate
    .replace(
      '$componentDeclarations',
      componentWithoutIndex.map(defineComponentDecl).join('\n')
    )
    .replace(
      '$componentImports',
      componentWithoutIndex.map(importComponent).join('\n')
    )
    .replace(
      '$componentExports',
      componentWithoutIndex.map(exportComponent).join('\n')
    )

  fs.writeFileSync(path.resolve(generatedPath, 'index.gen.ts'), indexContent)

  const globalContent = globalTemplate
    .replace(
      '$allGlobalComponentsImports',
      componentWithoutIndex.map(importComponentFromIndex).join('\n')
    )
    .replace(
      '$allGlobalComponents',
      componentWithoutIndex.map(defineGlobalComponentDecl).join('\n')
    )

  fs.writeFileSync(path.resolve(generatedPath, 'global.gen.ts'), globalContent)

  generateExportedTypes(generatedPath)
}

export function generateNameMappings(param: {
  components: Component[]
  generatedPath: string
}) {
  const { components, generatedPath } = param

  const componentsMapping: Record<string, number> = {
    'core::Transform': 1
  }

  components.forEach(($) => {
    componentsMapping['core::' + $.componentPascalName] = $.componentId
  })

  const content = `
/**
 * Autogenerated mapping of core components to their component numbers
 */
export const coreComponentMappings: Record<string, number> = ${JSON.stringify(
    componentsMapping,
    null,
    2
  )}
`

  fs.writeFileSync(
    path.resolve(generatedPath, 'component-names.gen.ts'),
    content
  )
}
