const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/productRoutes");


const app = express();

app.use(cors({
  origin: "http://localhost:5173", // or 5173 if Vite
  credentials: true,
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);


module.exports = app;
