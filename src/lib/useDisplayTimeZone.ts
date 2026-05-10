import { useEffect, useState } from 'react'
import { browserTimeZone, HAMMA_BOWL_DEFAULT_TIME_ZONE } from './format'

export function useDisplayTimeZone() {
  const [timeZone, setTimeZone] = useState(HAMMA_BOWL_DEFAULT_TIME_ZONE)

  useEffect(() => {
    setTimeZone(browserTimeZone())
  }, [])

  return timeZone
}
