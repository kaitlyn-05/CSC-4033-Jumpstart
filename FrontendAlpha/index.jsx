//libraries imported 
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

//React test component for Jumpstart 
function Application() {
  const [page, setPage] = useState("welcome");
if (page === "login") {
    return (
    <main className="welcome-page">
      <h1>Log In</h1>
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          alert("Login is not connected to the backend yet.");
        }}
      >
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          name="username"
          type="text"
          placeholder="Enter username"
          autoComplete="username"
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          placeholder="Enter password"
          autoComplete="current-password"
          required
        />
        <button className="welcome-button" type="submit">Log In</button>
      </form>
      <button onClick={() => setPage("welcome")}>Back to welcome</button>
    </main>
    );
  }
  if (page === "signup") {
    return (
      <main className="welcome-page">
        <h1>Create Account</h1>
        <form
          className="account-form"
          onSubmit={(event) => {
            event.preventDefault();
            alert("Account creation is not connected to the backend yet.");
          }}
        >
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            placeholder="Create username"
            autoComplete="username"
            required
          />
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            placeholder="Create password"
            autoComplete="new-password"
            required
          />
          <button className="welcome-button" type="submit">
            Create Account
          </button>
        </form>
        <button onClick={() => setPage("welcome")}>Back to welcome</button>
      </main>
    );
  }
  return (
    <main className="welcome-page">
      <h1 className="welcome-title">JumpStart</h1>
      <div className="welcome-actions">
        <button
          className="welcome-button"
          onClick={() => setPage("login")}>Log In</button>
        <button
          className="welcome-button"
          onClick={() => setPage("signup")}>Create Account</button>
      </div>
    </main>
  );
}

//Creates const to get id from "index.html"
const container = document.getElementById("root");
//Creates a root container for the React application
const root = createRoot(container);
root.render(<Application />);
