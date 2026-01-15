import React from 'react'
import Login from "./components/auth/login";
import Register from "./components/auth/register";

import Header from "./components/header";
import Home from "./components/home";

import { AuthProvider } from "./contexts/authContext";
import { ThemeProvider } from './contexts/ThemeContext';

import { useRoutes, useLocation } from "react-router-dom";
import './styles/theme.css';

function App() {
  const routesArray = [
    {
      path: "*",
      element: <Login />,
    },
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/register",
      element: <Register />,
    },
    {
      path: "/home",
      element: <Home />,
    },
  ];
  let routesElement = useRoutes(routesArray);
  const location = useLocation();
  const showHeader = location.pathname === '/' || location.pathname.startsWith('/login') || location.pathname.startsWith('/register');
  return (
    <AuthProvider>
      <ThemeProvider>
        {showHeader && <Header />}
        <div className="app-content">{routesElement}</div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;