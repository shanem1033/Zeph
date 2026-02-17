import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Airline() {
  const router = useRouter()
  useEffect(() => { router.replace('/airline/dashboard') }, [router])
  return null
}
