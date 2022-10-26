import { EntityComponents } from '../react-ecs'
import {
  Container,
  HostContext,
  Instance,
  OpaqueHandle,
  Props,
  PublicInstance,
  SuspenseInstance,
  TextInstance,
  TimeoutHandle,
  Type
} from './types'

const entityComponent: EntityComponents = {
  uiText: undefined as any,
  uiBackground: undefined as any,
  uiTransform: undefined as any,
  onClick: undefined as any
}
export const componentKeys: (keyof EntityComponents)[] = Object.keys(
  entityComponent
) as (keyof EntityComponents)[]

export function isEqual<T = unknown>(val1: T, val2: T): boolean {
  if (!val1 && !val2) {
    return true
  }

  if (!val1 || !val2) {
    return val1 === val2
  }

  if (val1 === val2) {
    return true
  }

  if (typeof val1 !== typeof val2) {
    return false
  }

  if (typeof val1 !== 'object') {
    return val1 === val2
  }

  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) {
      return false
    }
  }

  if (Object.keys(val1).length !== Object.keys(val2).length) {
    return false
  }

  if (JSON.stringify(val1) === JSON.stringify(val2)) {
    return true
  }

  for (const key in val1) {
    if (!isEqual(val1[key]!, val2[key]!)) {
      return false
    }
  }

  return true
}

export const isNotUndefined = <T>(val: T | undefined): val is T => {
  return !!val
}

export const noopConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  noTimeout: -1,
  isPrimaryRenderer: true,
  supportsHydration: false,

  insertInContainerBefore(
    _container: Container,
    _child: Instance | TextInstance,
    _beforeChild: Instance | TextInstance | SuspenseInstance
  ): void {
    // console.log('insertIncontainerBefore TODO')
  },

  detachDeletedInstance: function (_node: Instance): void {
    // console.log('detahDeletedInstance')
    // console.log({ node })
  },
  hideInstance(_instance: Instance): void {},
  hideTextInstance(_textInstance: TextInstance): void {},
  unhideInstance(_instance: Instance, _props: Props): void {},
  unhideTextInstance(_textInstance: TextInstance, _text: string): void {},
  clearContainer(_container: Container): void {},
  getCurrentEventPriority: function (): number {
    return 0
  },
  getInstanceFromNode: function (_node: Instance): null | undefined {
    return null
  },
  beforeActiveInstanceBlur: function (): void {},
  afterActiveInstanceBlur: function (): void {},
  prepareScopeUpdate: function (
    _scopeInstance: any,
    _instance: Instance
  ): void {},
  getInstanceFromScope: function (_scopeInstance: Instance): Instance | null {
    return null
  },
  removeChildFromContainer: () => {},
  commitMount(
    _instance: Instance,
    _type: Type,
    _props: Props,
    _internalInstanceHandle: OpaqueHandle
  ): void {},
  resetTextContent(_instance: Instance): void {},
  commitTextUpdate(
    _textInstance: TextInstance,
    _oldText: string,
    _newText: string
  ): void {},
  prepareForCommit(_containerInfo: Container): Record<string, any> | null {
    return null
  },
  resetAfterCommit(_containerInfo: Container): void {},
  preparePortalMount(_containerInfo: Container): void {},
  createTextInstance(
    _text: string,
    _rootContainer: Container,
    _hostContext: HostContext,
    _internalHandle: OpaqueHandle
  ): TextInstance {
    return {} as TextInstance
  },
  scheduleTimeout(_fn: any, _delay?: number): TimeoutHandle {},
  cancelTimeout(_id: TimeoutHandle): void {},
  shouldSetTextContent(_type: Type, _props: Props): boolean {
    return false
  },
  getRootHostContext(_rootContainer: Container): HostContext | null {
    return null
  },
  getChildHostContext(
    _parentHostContext: HostContext,
    _type: Type,
    _rootContainer: Container
  ): HostContext {
    return null
  },
  getPublicInstance(instance: Instance): PublicInstance {
    return instance
  },
  finalizeInitialChildren(
    _instance: Instance,
    _type: Type,
    _props: Props,
    _rootContainer: Container,
    _hostContext: HostContext
  ): boolean {
    return false
  }
}
