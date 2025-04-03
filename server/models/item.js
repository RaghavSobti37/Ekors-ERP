const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
    firstname : String,
    lastname : String,
    email : String,
    phone : Number,
    password : String,
})

const itemModel = mongoose.model("Item" , itemSchema)
module.exports = itemModel