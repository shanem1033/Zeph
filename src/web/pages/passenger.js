import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Passenger() {
  const router = useRouter()
  useEffect(() => { router.replace('/passenger/dashboard') }, [router])
  return null
}
