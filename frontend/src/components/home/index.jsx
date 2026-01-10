import React from 'react'
import { useAuth } from '../../contexts/authContext'
import Dashboard from '../dashboard/Dashboard'

// Render the Dashboard as the home route so users see the main UI after login.
const Home = () => {
    const { currentUser } = useAuth()
    // Optionally you can check currentUser and show a loader or message if not yet loaded.
    return (
        <Dashboard />
    )
}

export default Home