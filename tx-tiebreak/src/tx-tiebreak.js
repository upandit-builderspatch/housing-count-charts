// TDHCA 2026 §11.7(2) Amenities Tie-Breaker Calculator
// Matches the distance formula and logic from TDHCA's official sheet exactly.

/**
 * Compute distance using TDHCA's spherical law of cosines formula.
 * R = 3,959 miles = 20,900,320 feet, then convert miles to feet via * 5,280.
 * Formula: ACOS(cos(90°-lat1)·cos(90°-lat2) + sin(90°-lat1)·sin(90°-lat2)·cos(lon1-lon2)) * radius
 *
 * @param {number} lat1 - Site latitude in degrees
 * @param {number} lon1 - Site longitude in degrees (negative for West)
 * @param {number} lat2 - Feature latitude in degrees
 * @param {number} lon2 - Feature longitude in degrees
 * @returns {number} Distance in feet
 */
export function tdhcaDistanceFeet(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const c =
    Math.cos(rad(90 - lat1)) * Math.cos(rad(90 - lat2)) +
    Math.sin(rad(90 - lat1)) * Math.sin(rad(90 - lat2)) * Math.cos(rad(lon1 - lon2));
  // Clamp cosine to <= 1 to prevent NaN from floating-point errors
  return Math.acos(Math.min(1, c)) * 3959 * 5280;
}

/**
 * Compute the amenity tie-breaker total: sum of three shortest distances.
 * If exactly one of the three shortest is disqualified, the fourth replaces it.
 * If two or more of the three shortest are disqualified, return null (no preference).
 *
 * @param {number[]} distances - Four distances in any order (feet)
 * @param {boolean[]} disqualified - Parallel array of disqualification flags
 * @returns {number|null} Total in feet, or null if no preference
 */
export function computeTiebreaker(distances, disqualified) {
  // Pair each distance with its index and disqualification status
  const paired = distances.map((dist, i) => ({
    dist,
    index: i,
    disq: disqualified[i],
  }));

  // Sort by distance to identify the three shortest
  paired.sort((a, b) => a.dist - b.dist);

  // Check the top three
  const top3 = paired.slice(0, 3);
  const disqCount = top3.filter((p) => p.disq).length;

  if (disqCount === 0) {
    // None disqualified: sum the three shortest
    return top3.reduce((sum, p) => sum + p.dist, 0);
  } else if (disqCount === 1) {
    // Exactly one disqualified: replace with the fourth
    const fourth = paired[3];
    return (
      top3.filter((p) => !p.disq).reduce((sum, p) => sum + p.dist, 0) + fourth.dist
    );
  } else {
    // Two or more disqualified: no preference
    return null;
  }
}

/**
 * Determine if two tiebreaker totals should remain tied.
 * Ties persist if the difference is <= 100 feet.
 *
 * @param {number} total1 - First tiebreaker total (feet)
 * @param {number} total2 - Second tiebreaker total (feet)
 * @returns {boolean} True if tied within 100 ft
 */
export function isTied(total1, total2) {
  return Math.abs(total1 - total2) <= 100;
}

/**
 * Format a distance value for display.
 * No rounding in storage; display with up to 1 decimal place if needed.
 *
 * @param {number} feet - Distance in feet
 * @returns {string} Formatted string like "1,425.7 ft"
 */
export function formatDistance(feet) {
  const rounded = Math.round(feet * 10) / 10;
  return `${rounded.toLocaleString()} ft`;
}
