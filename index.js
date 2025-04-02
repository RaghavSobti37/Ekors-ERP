const express = require('express');
const connectDB = require('./db.js')

const app = express();

connectDB()

app.listen(3000, ()=> {
  console.log("App is Running")
})
