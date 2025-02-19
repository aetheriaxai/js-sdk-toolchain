import { InputHTMLAttributes, useCallback, useEffect, useRef, useState } from 'react'
import { Entity } from '@dcl/ecs'
import { getValue, NestedKey, setValue } from '../../lib/logic/get-set-value'
import { Component } from '../../lib/sdk/components'
import { useComponentValue } from './useComponentValue'

type Input = {
  [key: string]: string | Record<string, string | Input>
}

export function isValidNumericInput(input: Input | string): boolean {
  if (typeof input === 'object') {
    return Object.values(input).every((value) => isValidNumericInput(value))
  }
  return input.length > 0 && !isNaN(Number(input))
}

export const useComponentInput = <ComponentValueType extends object, InputType extends Input>(
  entity: Entity,
  component: Component<ComponentValueType>,
  fromComponentValueToInput: (componentValue: ComponentValueType) => InputType,
  fromInputToComponentValue: (input: InputType) => ComponentValueType,
  validateInput: (input: InputType) => boolean = () => true,
  deps: unknown[] = []
) => {
  const [componentValue, setComponentValue, isEqual] = useComponentValue<ComponentValueType>(entity, component)
  const [input, setInput] = useState<InputType | null>(
    componentValue === null ? null : fromComponentValueToInput(componentValue)
  )
  const [isFocused, setIsFocused] = useState(false)
  const skipSyncRef = useRef(false)
  const [isValid, setIsValid] = useState(false)

  const updateInputs = useCallback((value: InputType | null, skipSync = false) => {
    skipSyncRef.current = skipSync
    setInput(value)
  }, [])

  const handleUpdate = (path: NestedKey<InputType>) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (input === null) return
    const newInputs = setValue(input, path, event.target.value as any)
    updateInputs(newInputs)
  }

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    if (componentValue === null) return
    setIsFocused(false)
    updateInputs(fromComponentValueToInput(componentValue))
  }, [componentValue])

  const validate = useCallback(
    (input: InputType | null): input is InputType => input !== null && validateInput(input),
    [input, ...deps]
  )

  // sync inputs -> engine
  useEffect(() => {
    if (skipSyncRef.current) return
    if (validate(input)) {
      const newComponentValue = { ...componentValue, ...fromInputToComponentValue(input) }

      if (isEqual(newComponentValue)) {
        return
      }
      setComponentValue(newComponentValue)
    }
  }, [input])

  // sync engine -> inputs
  useEffect(() => {
    if (componentValue === null) return
    if (isFocused) {
      // skip sync from state while editing, to avoid overriding the user input
      return
    }
    const newInputs = fromComponentValueToInput(componentValue)
    // set "skipSync" to avoid cyclic component value change
    updateInputs(newInputs, true)
  }, [componentValue])

  useEffect(() => {
    setIsValid(validate(input))
  }, [input, ...deps])

  const getProps = useCallback(
    (
      path: NestedKey<InputType>
    ): Pick<InputHTMLAttributes<HTMLElement>, 'value' | 'onChange' | 'onFocus' | 'onBlur'> => {
      const value = getValue(input, path) || ''

      return {
        value: value.toString(),
        onChange: handleUpdate(path),
        onFocus: handleFocus,
        onBlur: handleBlur
      }
    },
    [handleUpdate, handleFocus, handleBlur, input]
  )

  return { getInputProps: getProps, isValid }
}
