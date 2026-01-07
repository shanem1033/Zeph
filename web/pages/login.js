import { useState } from 'react'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const submit = (e) => {
    e.preventDefault()
    // default demo accounts
    if (username === 'airline' && password === 'airline'){
      localStorage.setItem('user', JSON.stringify({ username: 'airline', role: 'airline' }))
      router.push('/airline')
      return
    }
    if (username === 'passenger' && password === 'passenger'){
      localStorage.setItem('user', JSON.stringify({ username: 'passenger', role: 'passenger' }))
      router.push('/passenger')
      return
    }
    alert('Invalid credentials. Use airline/airline or passenger/passenger')
  }

  return (
    <div className="container">
      <Nav />
      <main>
        <h1>Login</h1>
        <form onSubmit={submit} className="form">
          <label>Username
            <input value={username} onChange={(e)=>setUsername(e.target.value)} />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </label>
          <button type="submit">Login</button>
        </form>
      </main>
    </div>
  )
}
