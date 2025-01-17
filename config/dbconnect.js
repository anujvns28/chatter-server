const mongoose = require("mongoose")
require("dotenv").config();

exports.dbConnection = () =>{
    mongoose.connect(process.env.DATABASE_URL, {
        useNewUrlParser: true, 
        useUnifiedTopology: true 
       })
     .then(() => console.log('MongoDB connected...'))
     .catch(err => console.log(err,"error occured in db connection"));
}