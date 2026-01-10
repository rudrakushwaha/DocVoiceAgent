import React from 'react'
import Login from "./components/auth/login";
import Register from "./components/auth/register";

import Header from "./components/header";
import Home from "./components/home";

import { AuthProvider } from "./contexts/authContext";
import { useRoutes, useLocation } from "react-router-dom";

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
      {showHeader && <Header />}
      <div className="app-content">{routesElement}</div>
    </AuthProvider>
  );
}

export default App;