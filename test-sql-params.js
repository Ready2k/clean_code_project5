// Test to demonstrate the SQL parameter issue
const paramIndex = 1;

// This is WRONG - missing $ sign
const wrongQuery = `SELECT * FROM models WHERE provider_id = ${paramIndex}`;
console.log('Wrong query:', wrongQuery);

// This is CORRECT - has $ sign
const correctQuery = `SELECT * FROM models WHERE provider_id = $${paramIndex}`;
console.log('Correct query:', correctQuery);

// The issue is that ${paramIndex} evaluates to just the number (1)
// But $${paramIndex} evaluates to $1 which is the correct PostgreSQL parameter placeholder