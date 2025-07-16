// Test file to verify ticket number generation
const { generateTicketNumber } = require('./utils/ticketNumberGenerator');

console.log('Testing ticket number generation:');
console.log('Generated ticket number:', generateTicketNumber());
console.log('Expected format: EKORS/YYMMDD-HHMMSS');

// Test multiple generations to ensure uniqueness
setTimeout(() => {
  console.log('Second generation:', generateTicketNumber());
}, 1000);

setTimeout(() => {
  console.log('Third generation:', generateTicketNumber());
}, 2000);
