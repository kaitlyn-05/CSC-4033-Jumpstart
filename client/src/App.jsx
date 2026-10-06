import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5000/api/hello")
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch((error) => {
        console.error("Error connecting to backend:", error);
        setMessage("Could not connect to backend");
      });
  }, []);

  return (
    <div>
      <h1>Jumpstart</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
