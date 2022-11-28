import { ComponentDefinition } from './component'

/**
 * @public
 */
export type DeepReadonlyMap<K, V> = ReadonlyMap<
  DeepReadonly<K>,
  DeepReadonly<V>
>
/**
 * @public
 */
export type DeepReadonlySet<T> = ReadonlySet<DeepReadonly<T>>
/**
 * @public
 */
export type DeepReadonlyObject<T> = {
  readonly [K in keyof T]: DeepReadonly<T[K]>
}
/**
 * @public
 */
export type ReadonlyPrimitive =
  | number
  | string
  | number[]
  | string[]
  | boolean
  | boolean[]

/**
 * @public
 */
export type ReadonlyComponentSchema<
  T extends [ComponentDefinition<any, any>, ...ComponentDefinition<any, any>[]]
> = {
  [K in keyof T]: T[K] extends ComponentDefinition<any, any>
    ? ReturnType<T[K]['get']>
    : never
}

/**
 * @public
 */
export type DeepReadonly<T> = T extends ReadonlyPrimitive
  ? T
  : T extends Map<infer K, infer V>
  ? DeepReadonlyMap<K, V>
  : T extends Set<infer M>
  ? DeepReadonlySet<M>
  : DeepReadonlyObject<T>

/**
 * @internal
 */
export function deepReadonly<T extends Record<string, unknown>>(
  val: T
): DeepReadonly<T> {
  return Object.freeze({ ...val }) as DeepReadonly<T>
}
