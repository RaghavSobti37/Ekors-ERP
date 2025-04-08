const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    firstname : String,
    lastname : String,
    email : String,
    phone : Number,
    password : String,
})

const userModel = mongoose.model("User" , userSchema)
module.exports = userModel