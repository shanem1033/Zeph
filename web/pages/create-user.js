import { useState } from 'react'
import Nav from '../components/Nav'

export default function CreateUser(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = (e) => {
    e.preventDefault()
    // stub: do nothing for now
    alert('Create user stub — does nothing for now')
  }

  return (
    <div className="container">
      <Nav />
      <main>
        <h1>Create User (stub)</h1>
        <form onSubmit={submit} className="form">
          <label>Username
            <input value={username} onChange={(e)=>setUsername(e.target.value)} />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          </label>
          <label>Confirm Password
            <input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
          </label>
          <button type="submit">Create</button>
        </form>
      </main>
    </div>
  )
}
