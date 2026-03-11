import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Passenger() {
  const router = useRouter()
  useEffect(() => { router.replace('/passenger/register-flight') }, [router])
  return null
}
