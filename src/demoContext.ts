/**
 * Snapshot of the demo squad ("MHacks Crew") sent to the brain as DATA.
 * The web app keeps real data in each browser (mock mode), so an iMessage agent can only see this shared demo squad.
 * When ShamePool runs on the live Spacetime backend this is where the agent would read the real squad instead.
 */
export function demoContext(now = new Date()): Record<string, unknown> {
  return {
    today: now.toISOString().slice(0, 10),
    note: 'Demo squad data. The person writing is a guest on iMessage, not a squad member.',
    squad: {
      name: 'MHacks Crew', pool: '$35', poolGoal: '$60', poolGoalName: 'Pizza night', charity: 'Local Food Bank',
    },
    leaderboard: [
      { rank: 1, name: 'Maya', weekCompletion: '100%', streak: 3, totalPaid: '$0' },
      { rank: 2, name: 'Ana', weekCompletion: '100%', streak: 6, totalPaid: '$0' },
      { rank: 3, name: 'Leo', weekCompletion: '50%', streak: 0, totalPaid: '$15' },
      { rank: 4, name: 'Kevin', weekCompletion: '50%', streak: 0, totalPaid: '$20', flakeOfTheWeek: true },
    ],
    recentFeed: [
      'Ana kept her promise: Morning run. 6 in a row.',
      'Leo flaked on "Practice guitar". $15 to the pool.',
      'Kevin flaked on "Gym". $20 to the pool.',
      'Maya committed to Yoga.',
    ],
    openVote: null,
  };
}
