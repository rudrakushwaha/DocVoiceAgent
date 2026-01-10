import React, { useState } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/authContext'
import { doCreateUserWithEmailAndPassword } from '../../../firebase/auth'
import { doSignOut } from '../../../firebase/auth'
import './style.css'

const Register = () => {

    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setconfirmPassword] = useState('')
    const [isRegistering, setIsRegistering] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [justRegistered, setJustRegistered] = useState(false)

    const { userLoggedIn } = useAuth()

    const onSubmit = async (e) => {
        e.preventDefault()
        if(!isRegistering) {
            setIsRegistering(true)
            setErrorMessage('')
            try {
                await doCreateUserWithEmailAndPassword(email, password)
                // After creating the account Firebase may sign the user in automatically.
                // We immediately sign them out and send them to the login page so they can
                // explicitly sign in.
                setJustRegistered(true)
                try {
                    await doSignOut()
                } catch (signOutErr) {
                    // non-fatal, show a message if needed
                    console.warn('Sign out after registration failed', signOutErr)
                }
                navigate('/login')
            } catch (err) {
                setErrorMessage(err?.message || String(err))
                setJustRegistered(false)
            } finally {
                setIsRegistering(false)
            }
        }
    }

    return (
        <>
            {userLoggedIn && !justRegistered && (<Navigate to={'/home'} replace={true} />)}

            <main className="register-page">
                <div className="register-card">
                    <div className="register-grid">
                        <div className="register-left">
                            <h3 className="huge-title">Create a New Account</h3>
                            <p className="muted" style={{marginTop:6}}>Start your journey with DocVoice</p>

                            <form onSubmit={onSubmit} style={{marginTop:18}}>
                                <div className="form-field">
                                    <label>Email</label>
                                    <input type="email" autoComplete='email' required value={email} onChange={(e)=>setEmail(e.target.value)} className="input" />
                                </div>

                                <div className="form-field">
                                    <label>Password</label>
                                    <input disabled={isRegistering} type="password" autoComplete='new-password' required value={password} onChange={(e)=>setPassword(e.target.value)} className="input" />
                                </div>

                                <div className="form-field">
                                    <label>Confirm Password</label>
                                    <input disabled={isRegistering} type="password" autoComplete='off' required value={confirmPassword} onChange={(e)=>setconfirmPassword(e.target.value)} className="input" />
                                </div>

                                {errorMessage && <div style={{color:'#dc2626', marginTop:8}}>{errorMessage}</div>}

                                <div style={{marginTop:16}}>
                                    <button type="submit" disabled={isRegistering} className="btn-primary">{isRegistering ? 'Signing Up...' : 'Sign Up'}</button>
                                </div>

                                <div style={{marginTop:12, textAlign:'center'}} className="note">Already have an account? <Link to={'/login'} style={{fontWeight:700, color:'var(--accent)'}}>Continue</Link></div>
                            </form>
                        </div>

                        <aside className="register-right" aria-hidden>
                            <h3>Why join?</h3>
                            <p>Collaborate smarter. Turn documents into actions with voice-powered tools.</p>
                            <ul>
                                <li><span className="dot"></span> Real-time collaboration</li>
                                <li><span className="dot"></span> Private & encrypted</li>
                                <li><span className="dot"></span> Google sign-in support</li>
                            </ul>
                        </aside>
                    </div>
                </div>
            </main>
        </>
    )
}

export default Register