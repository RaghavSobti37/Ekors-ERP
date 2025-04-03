const express = require('express');
const connectDB = require('./db.js')
const cors = require('cors');
const itemModel = require('./models/item.js');

const app = express();
app.use(express.json());
app.use(cors());
connectDB();

app.get('/' , async (req,res) => {
    const response = await itemModel.find()
    return res.json({items : response})
})

app.post('/register' , (req , res)=> {
  
})

app.listen(3000, ()=> {
  console.log("App is Running")
})
