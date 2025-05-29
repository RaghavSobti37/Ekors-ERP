// server/utils/helpers.js

function formatDateRange(start, end) {
  return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
}

module.exports = {
  formatDateRange
};
