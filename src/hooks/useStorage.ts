import { useState, useEffect, useCallback } from 'react'

type StorageArea = 'local' | 'sync'

declare const chrome: typeof globalThis extends { chrome: infer C } ? C : never

function chromeGet<T>(key: string, area: StorageArea): Promise<T | null> {
  return new Promise(resolve => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome
    if (!c?.storage) { resolve(null); return }
    c.storage[area].get(key, (result: Record<string, T>) => resolve(result[key] ?? null))
  })
}

function chromeSet(key: string, value: unknown, area: StorageArea): Promise<void> {
  return new Promise(resolve => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome
    if (!c?.storage) { resolve(); return }
    c.storage[area].set({ [key]: value }, resolve)
  })
}

export function useStorage<T>(
  key: string,
  defaultValue: T,
  area: StorageArea = 'local',
): [T, (val: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    chromeGet<T>(key, area).then(stored => {
      if (stored !== null) setValue(stored)
      setLoaded(true)
    })
  }, [key, area])

  const set = useCallback(async (val: T) => {
    setValue(val)
    await chromeSet(key, val, area)
  }, [key, area])

  return [value, set, loaded]
}
