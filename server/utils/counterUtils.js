// utils/counterUtils.js
const Counter = require('../models/counter');

async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  
  return counter.sequence_value;
}

module.exports = { getNextSequence };