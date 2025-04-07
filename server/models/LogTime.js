const mongoose = require('mongoose');

const logTimeSchema = new mongoose.Schema({
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
