import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Airline() {
  const router = useRouter()
  useEffect(() => { router.replace('/airline/claims') }, [router])
  return null
}
