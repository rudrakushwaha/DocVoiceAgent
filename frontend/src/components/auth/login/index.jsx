import React, { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { doSignInWithEmailAndPassword, doSignInWithGoogle } from '../../../firebase/auth'
import { useAuth } from '../../../contexts/authContext'
import './style.css'


const Login = () => {
    const { userLoggedIn } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSigningIn, setIsSigningIn] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const onSubmit = async (e) => {
        e.preventDefault()
        if (!isSigningIn) {
            setIsSigningIn(true)
            setErrorMessage('')
            try {
                await doSignInWithEmailAndPassword(email, password)
                // doSendEmailVerification()
            } catch (err) {
                // show friendly message
                setErrorMessage(err?.message || String(err))
            } finally {
                setIsSigningIn(false)
            }
        }
    }

    const onGoogleSignIn = async (e) => {
        e.preventDefault()
        if (!isSigningIn) {
            setIsSigningIn(true)
            setErrorMessage('')
            try {
                await doSignInWithGoogle()
            } catch (err) {
                setErrorMessage(err?.message || String(err))
            } finally {
                setIsSigningIn(false)
            }
        }
    }

    return (
        <div>
            {userLoggedIn && <Navigate to={'/home'} replace={true} />}

            <main className="login-page">
                <div className="login-card">
                    <div className="login-decor" aria-hidden></div>

                    <div className="login-form-wrap">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <div className="brand-badge">DV</div>
                                <span className='brand-name'>DocVoice AI-AGENT</span>
                            </div>
                            <div style={{display:'none'}} className="md-only" />
                        </div>

                        <h3 className="login-title">Welcome Back</h3>
                        <p className="login-sub">Sign in to access your dashboard</p>

                        <form onSubmit={onSubmit} style={{marginTop:18}} aria-label="login form">
                            <div className="form-field">
                                <label htmlFor="email">Email</label>
                                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="input" />
                            </div>

                            <div className="form-field">
                                <label htmlFor="password">Password</label>
                                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="input" />
                            </div>

                            {errorMessage && <div style={{color:'#dc2626', marginTop:8}}>{errorMessage}</div>}

                            <div style={{marginTop:18}}>
                                <button type="submit" disabled={isSigningIn} className="btn-primary">{isSigningIn ? 'Signing in...' : 'Sign In'}</button>
                            </div>

                            <p className="small-note" style={{marginTop:12}}>Don't have an account? <Link to={'/register'} style={{color:'var(--accent)', fontWeight:700}}>Create one</Link></p>

                            <div className="hr-row">
                                <div className="line"></div>
                                <div className="link-muted">OR</div>
                                <div className="line"></div>
                            </div>

                            <div style={{marginTop:12}}>
                                <button type="button" disabled={isSigningIn} onClick={onGoogleSignIn} className="btn-ghost">
                                    <span className="icon-wrap" aria-hidden>
                                        <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <g clipPath="url(#clip0_17_40)">
                                                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4" />
                                                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853" />
                                                <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04" />
                                                <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335" />
                                            </g>
                                        </svg>
                                    </span>
                                    {isSigningIn ? 'Signing in...' : 'Continue with Google'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <aside className="login-side" aria-hidden>
                        <h3>Secure & Fast</h3>
                        <p>Access your documents, projects and voice assistant tools all in one place.</p>
                        <ul>
                            <li><span className="pill"></span> Real-time sync</li>
                            <li><span className="pill"></span> Encrypted storage</li>
                            <li><span className="pill"></span> Seamless Google sign-in</li>
                        </ul>
                    </aside>
                </div>
            </main>
        </div>
    )
}

export default Login