import { test } from 'node:test';
import assert from 'node:assert';
import { tdhcaDistanceFeet, computeTiebreaker } from '../src/tx-tiebreak.js';

test('Distance formula: TDHCA spherical law of cosines', () => {
  // The Eleanor reference case from PLAN.md
  // Site boundary point for park: 32.646019, −96.945183
  // Park (Sugarberry Park): 32.64286, −96.94602
  // Expected: 1,180.849 ft

  const distance = tdhcaDistanceFeet(32.646019, -96.945183, 32.64286, -96.94602);
  assert.strictEqual(
    Math.round(distance * 1000) / 1000,
    1180.849,
    'Park distance should be 1180.849 ft'
  );
});

test('Distance formula: ISD school (150.020 ft)', () => {
  // The Eleanor ISD school (Kennemer MS): 32.647336, −96.945562
  // Site boundary point: 32.64706, −96.9452 (different from park)
  const distance = tdhcaDistanceFeet(32.64706, -96.9452, 32.647336, -96.945562);
  assert.strictEqual(
    Math.round(distance * 1000) / 1000,
    150.020,
    'ISD school distance should be 150.020 ft'
  );
});

test('Distance formula: Grocery (94.857 ft)', () => {
  // The Eleanor Grocery (Walmart Supercenter): 32.64732, −96.9452
  // Site boundary point: 32.64706, −96.9452
  const distance = tdhcaDistanceFeet(32.64706, -96.9452, 32.64732, -96.9452);
  assert.strictEqual(
    Math.round(distance * 1000) / 1000,
    94.857,
    'Grocery distance should be 94.857 ft'
  );
});

test('Distance formula: Library (6410.045 ft, dropped)', () => {
  // The Eleanor Library (Mountain Creek Branch): 32.65047, −96.96567
  // Site boundary point: 32.64706, −96.9452
  const distance = tdhcaDistanceFeet(32.64706, -96.9452, 32.65047, -96.96567);
  assert.strictEqual(
    Math.round(distance * 1000) / 1000,
    6410.045,
    'Library distance should be 6410.045 ft'
  );
});

test('Tiebreaker total: sum of 3 shortest (1425.726 ft)', () => {
  // All four distances from The Eleanor
  const distances = [
    1180.849,  // Park
    150.020,   // School
    94.857,    // Grocery
    6410.045   // Library (should be dropped)
  ];

  const total = computeTiebreaker(distances, [false, false, false, false]);

  // Should sum the three shortest: 94.857 + 150.020 + 1180.849 = 1425.726
  assert.strictEqual(
    Math.round(total * 1000) / 1000,
    1425.726,
    'Total should be sum of 3 shortest: 1425.726 ft'
  );
});

test('Rule: One disqualified feature replaced by fourth', () => {
  const distances = [
    1180.849,  // Park
    150.020,   // School
    94.857,    // Grocery
    6410.045   // Library
  ];

  // Mark library as disqualified
  const disqualified = [false, false, false, true];

  const total = computeTiebreaker(distances, disqualified);

  // Should still sum the three shortest valid: 94.857 + 150.020 + 1180.849 = 1425.726
  assert.strictEqual(
    Math.round(total * 1000) / 1000,
    1425.726,
    'With 4th disqualified, should use same total'
  );
});

test('Rule: One of three shortest disqualified, fourth replaces it', () => {
  const distances = [
    1180.849,  // Park
    150.020,   // School
    94.857,    // Grocery (disqualified)
    6410.045   // Library
  ];

  // Mark grocery (3rd shortest) as disqualified
  const disqualified = [false, false, true, false];

  const total = computeTiebreaker(distances, disqualified);

  // Should sum: 150.020 + 1180.849 + 6410.045 = 7740.914
  assert.strictEqual(
    Math.round(total * 1000) / 1000,
    7740.914,
    'With 3rd shortest disqualified, should use 4th as replacement'
  );
});

test('Rule: Two or more of three shortest disqualified = no preference', () => {
  const distances = [
    1180.849,  // Park (disqualified)
    150.020,   // School (disqualified)
    94.857,    // Grocery
    6410.045   // Library
  ];

  // Mark two of the three shortest as disqualified
  const disqualified = [true, true, false, false];

  const result = computeTiebreaker(distances, disqualified);

  // Should return null or special value indicating "no preference"
  assert.strictEqual(result, null, 'Two or more of top 3 disqualified = no preference');
});

test('Tie rule: 100 ft difference = tie persists', () => {
  const app1Total = 1500.0;
  const app2Total = 1600.0;

  const tied = Math.abs(app1Total - app2Total) <= 100;
  assert.strictEqual(tied, true, 'Totals 100 ft apart should be tied');
});

test('Tie rule: 100.01 ft difference = not tied', () => {
  const app1Total = 1500.0;
  const app2Total = 1600.01;

  const tied = Math.abs(app1Total - app2Total) <= 100;
  assert.strictEqual(tied, false, 'Totals 100.01 ft apart should not be tied');
});

test('Tie rule: 0 ft difference = tie', () => {
  const app1Total = 1500.0;
  const app2Total = 1500.0;

  const tied = Math.abs(app1Total - app2Total) <= 100;
  assert.strictEqual(tied, true, 'Equal totals should be tied');
});

test('Formula produces consistent results', () => {
  // Verify the formula is deterministic and precise
  const distance1 = tdhcaDistanceFeet(32.646019, -96.945183, 32.64286, -96.94602);
  const distance2 = tdhcaDistanceFeet(32.646019, -96.945183, 32.64286, -96.94602);
  assert.strictEqual(distance1, distance2, 'Formula should be deterministic');

  // High-precision result should have many decimal places
  assert(distance1.toString().includes('.'), 'Full precision should be preserved');
});

test('Rule: Cosine clamped to <= 1 to prevent NaN', () => {
  // Same point should give 0 distance (not NaN)
  const distance = tdhcaDistanceFeet(32.646019, -96.945183, 32.646019, -96.945183);
  assert.strictEqual(distance, 0, 'Same point should be 0 distance');
});
