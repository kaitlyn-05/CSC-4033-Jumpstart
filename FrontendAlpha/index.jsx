import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx"; // <-- This imports the file you've been editing!

// Get the root container from your index.html
const container = document.getElementById("root");

// Create the React root and render your main App component
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
