﻿import { Engine, components } from '../../../packages/@dcl/ecs/src'
import { testComponentSerialization } from './assertion'

describe('Generated Animator ProtoBuf', () => {
  it('should serialize/deserialize Animator', () => {
    const newEngine = Engine()
    const Animator = components.Animator(newEngine)
    testComponentSerialization(Animator, {
      states: [
        {
          name: 'test',
          clip: 'gge',
          playing: true,
          loop: true,
          shouldReset: false,
          weight: 1,
          speed: 1
        }
      ]
    })

    testComponentSerialization(Animator, {
      states: [
        {
          name: 'test2',
          clip: 'gfgge',
          playing: false,
          loop: false,
          shouldReset: true,
          weight: 0,
          speed: 0
        }
      ]
    })
  })

  it('should Animator.getClip helper works properly', () => {
    const newEngine = Engine()
    const Animator = components.Animator(newEngine)
    const entityWithoutAnimator = newEngine.addEntity()
    const entity = newEngine.addEntity()

    Animator.create(entity, {
      states: [
        {
          name: 'Some',
          clip: 'ClipSome'
        }
      ]
    })

    expect(() => {
      Animator.getClip(entityWithoutAnimator, 'Some')
    }).toThrowError()
    expect(Animator.getClipOrNull(entityWithoutAnimator, 'Some')).toBeNull()

    expect(Animator.getClipOrNull(entity, 'Some')).not.toBeNull()
    expect(Animator.getClip(entity, 'Some')).not.toBeNull()

    expect(() => {
      Animator.getClip(entity, 'SomeInexistent')
    }).toThrowError()
    expect(Animator.getClipOrNull(entity, 'SomeInexistent')).toBeNull()

    expect(Animator.getClip(entity, 'Some')).toStrictEqual({
      name: 'Some',
      clip: 'ClipSome'
    })
  })

  it('should Animator.playSingleAnimation and Animator.stops helper works properly', () => {
    const newEngine = Engine()
    const Animator = components.Animator(newEngine)
    const entity = newEngine.addEntity()
    const entityWithoutAnimator = newEngine.addEntity()

    Animator.create(entity, {
      states: [
        {
          name: 'Some',
          clip: 'ClipSome'
        }
      ]
    })

    expect(Animator.playSingleAnimation(entityWithoutAnimator, 'Some')).toBe(false)

    expect(Animator.getClip(entity, 'Some')!.playing).toBeFalsy()
    expect(Animator.playSingleAnimation(entity, 'SomeInexistent')).toBe(false)
    expect(Animator.playSingleAnimation(entity, 'Some')).toBe(true)

    expect(Animator.getClip(entity, 'Some')!.playing).toBe(true)

    expect(Animator.stopAllAnimations(entityWithoutAnimator)).toBe(false)
    expect(Animator.stopAllAnimations(entity)).toBe(true)
    expect(Animator.getClip(entity, 'Some')!.playing).toBe(false)
  })
})
