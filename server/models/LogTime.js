const mongoose = require('mongoose');

const logTimeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },  
  date: String,
  logs: [
    {
      task: String,
      start: String,
      finish: String,
      timeSpent: String,
    },
  ],
});

module.exports = mongoose.model('LogTime', logTimeSchema);
