const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
    firstname : String,
    lastname : String,
    email : String,
    phone : Int,
    password : String,
})

const itemModel = mongoose.model("Item" , itemSchema)
module.exports = itemModel