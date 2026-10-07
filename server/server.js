const express = require("express");
const cors = require("cors");
const helloRoutes = require("./routes/hello");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.use("/api", helloRoutes);


app.listen(PORT, () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
