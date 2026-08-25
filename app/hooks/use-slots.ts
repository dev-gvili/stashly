import React from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SlotConfig = Record<string, React.ElementType<any>>

type SlotElements<Type extends SlotConfig> = {
  [Property in keyof Type]: React.ReactElement<
    React.ComponentPropsWithoutRef<Type[Property]>,
    Type[Property]
  >
}

/**
 * Extracts named slot components from `children`, enabling compound components
 * to render sub-parts in different DOM positions. SSR-safe. Only inspects
 * direct children — nested slots are not detected.
 *
 * @param children - The component's `children` prop.
 * @param config - Map of slot name → component type (e.g. `{ header: Header, footer: Footer }`).
 *
 * @example
 * // Define slot components and extract them
 * const [{ header, footer }, body] = useSlots(children, { header: Header, footer: Footer })
 * return <div>{header}<main>{body}</main>{footer}</div>
 *
 * @example
 * // Slot is optional — check before rendering
 * const [{ icon }, rest] = useSlots(children, { icon: Icon })
 * return <button>{icon ?? <DefaultIcon />}{rest}</button>
 *
 * @example
 * // Used inside LayoutToggle to split River/Grid/List/Waterfall children
 * const [{ river, grid }, extra] = useSlots(children, { river: River, grid: Grid })
 */
export function useSlots<T extends SlotConfig>(
  children: React.ReactNode,
  config: T
): [Partial<SlotElements<T>>, React.ReactNode[]] {
  // Object mapping slot names to their elements
  const slots: Partial<SlotElements<T>> = mapValues(config, () => undefined)

  // Array of elements that are not slots
  const rest: React.ReactNode[] = []

  const keys = Object.keys(config) as Array<keyof T>
  const values = Object.values(config)

  // eslint-disable-next-line github/array-foreach
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      rest.push(child)
      return
    }

    const index = values.findIndex((value) => {
      return child.type === value
    })

    // If the child is not a slot, add it to the `rest` array
    if (index === -1) {
      rest.push(child)
      return
    }

    const slotKey = keys[index]

    // If slot is already filled, ignore duplicates
    if (slots[slotKey]) {
      console.warn(
        `Found duplicate "${String(
          slotKey
        )}" slot. Only the first will be rendered.`
      )
      return
    }

    // If the child is a slot, add it to the `slots` object
    slots[slotKey] = child as React.ReactElement<
      React.ComponentPropsWithoutRef<T[keyof T]>,
      T[keyof T]
    >
  })

  return [slots, rest]
}

/**
 * Maps every value of an object through `fn`, keeping the original keys.
 * Used here to seed the slots object with `undefined` for each configured
 * slot name, so callers can destructure a slot that was never provided.
 *
 * @param obj - Source object whose keys are preserved.
 * @param fn - Called once per value; its result becomes the new value.
 *
 * @example
 * // Seed a slot record with undefined placeholders
 * mapValues({ header: Header, footer: Footer }, () => undefined)
 * // → { header: undefined, footer: undefined }
 *
 * @example
 * // Any value transform works — keys stay put
 * mapValues({ a: 1, b: 2 }, (n) => (n as number) * 10) // → { a: 10, b: 20 }
 */
function mapValues<T extends Record<string, unknown>, V>(
  obj: T,
  fn: (value: T[keyof T]) => V
) {
  return Object.keys(obj).reduce(
    (result, key: keyof T) => {
      result[key] = fn(obj[key])
      return result
    },
    {} as Record<keyof T, V>
  )
}
