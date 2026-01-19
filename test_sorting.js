// test_sorting.js

console.log("=== Testing Participant Sorting Logic ===");

// 1. Setup Mock State
const state = {
    votesVisible: true,
    votes: {
        'user1': '5',
        'user2': '2',
        'user3': '8',
        'user4': '?',      // Non-numeric
        'user5': '13'
    },
    participants: [
        { id: 'user1', name: 'Alice (5)' },
        { id: 'user2', name: 'Bob (2)' },
        { id: 'user3', name: 'Charlie (8)' },
        { id: 'user4', name: 'David (?)' },
        { id: 'user5', name: 'Eve (13)' }
    ]
};

console.log("Initial Order:");
console.log(state.participants.map(p => p.name).join(', '));

// 2. The Sorting Logic (Copied from app.js)
let participantsToRender = [...state.participants];

if (state.votesVisible) {
    participantsToRender.sort((a, b) => {
        const voteA = state.votes[a.id];
        const voteB = state.votes[b.id];

        const valA = parseFloat(voteA);
        const valB = parseFloat(voteB);

        // Treat NaN as 0
        const numA = isNaN(valA) ? 0 : valA;
        const numB = isNaN(valB) ? 0 : valB;

        return numB - numA;
    });
}

// 3. Verify Results
console.log("\nSorted Order:");
const sortedNames = participantsToRender.map(p => p.name);
console.log(sortedNames.join(', '));

// 4. Assertions
const expectedOrder = [
    'Eve (13)',
    'Charlie (8)',
    'Alice (5)',
    'Bob (2)',
    'David (?)' // 0
];

let allCorrect = true;
for (let i = 0; i < expectedOrder.length; i++) {
    if (sortedNames[i] !== expectedOrder[i]) {
        console.error(`❌ Mismatch at index ${i}: Expected ${expectedOrder[i]}, got ${sortedNames[i]}`);
        allCorrect = false;
    }
}

if (allCorrect) {
    console.log("\n✅ TEST PASSED: Participants sorted correctly by vote value.");
} else {
    console.error("\n❌ TEST FAILED");
    process.exit(1);
}
