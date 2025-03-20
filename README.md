Skip to content
Navigation Menu
rgmelvin
solana-email

Type / to search
Code
Issues
Pull requests
Actions
Projects
Security
Insights
Settings
solana-email
/
README.md
in
main

Edit

Preview
Indent mode

Spaces
Indent size

2
Line wrap mode

Soft wrap
Editing README.md file contents
Selection deleted
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
97
98
99
100
101
102
103
104
105
106
107
108
109
110
111
112
113
114
115
116
117
118
119
120
121
122
123
124
# Solana Email Identity Service

The Solana Email Identity Service is a decentralized protocol built on Solana using the Anchor framework. It provides a secure foundation for user registration, profile management, and a protocol for sending on-chain email metadata with built-in spam prevention deposits.

## Features

- **User Registration:** Create a PDA-based user profile.
- **Profile Management:** Update user profile information such as display name.
- **Unregistration:** Close user profiles and reclaim lamports.
- **Email Sending:** Log on-chain email metadata along with a small deposit to deter spam.
- **Comprehensive Testing:** A full suite of unit and integration tests covering both positive and negative cases.
- **CI/CD Integration:** Automated build, deploy, and test pipeline using GitHub Actions.

## Getting Started

### Prerequisites

- **Rust:** [Install Rust](https://www.rust-lang.org/tools/install)
- **Anchor CLI:** [Installation Guide](https://project-serum.github.io/anchor/getting-started/installation.html)
- **Solana CLI:** [Install Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- **Node.js & Yarn:** [Download Node.js](https://nodejs.org/en/), [Install Yarn](https://yarnpkg.com/)

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/your-organization/solana-email.git
   cd solana-email

2. **Install Node Dependencies:**

   ```bash
   yarn install

### Local Development

1. **Start the Local Validator (if needed):**

   ```bash
   solana-test-validator --reset

2. **Build and Deploy the Program:**

   ```bash
   anchor clean && anchor build && anchor deploy

3. **Run the Test Suite:**

   ```bash
   yarn test

### Usage
Interact with the program using the Anchor TypeScript client. For example, to register a new user:

   ```ts
   const provider = anchor.AnchorProvider.local();
   anchor.setProvider(provider);
   const program = anchor.workspace.SolanaEmailIdentity as Program<SolanaEmailIdentity>;

   const user = provider.wallet.publicKey;
   const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.toBuffer()],
      program.programId
   );

   await program.methods.registerUser().accounts({
      userProfile: userProfilePda,
      owner: user,
      systemProgram: anchor.web3.SystemProgram.programId,
   }).rpc();
   ```
Your front-end or API client would similarly use the generated IDL to interact with these instructions.

### Testing
My test suite covers the following scenarios:
   - **Registering a New User:**<br>
         Verifies that a user profile can be created.
     
   - **Updating Profile Information:**<br>
         Tests successful updates and checks that unauthorized updates fail.
     
   - **Unregistering a User:**<br>
         Ensures the user profile is closed and funds are reclaimed.
     
   - **Sending an Email with Deposit:**<br>
         Confirms that the spam prevention deposit mechanism works.
     
   - **Negative Tests:**<br>
         Covers duplicate registration, insufficient funds, input boundary errors (e.g. overly long user names).
     
   - **End-To-End User Journey:**<br>
         Comfirms full functionality in a real use case situation.
     
To run the tests:
   ``` bash
       yarn test
   ```

### CI/CD Integration
My project uses GitHub Actions to automate building, deploying, and testing on every push and pull request. See the [.github/workflows/ci.yml](.github/workflows/ci.yml) file for the full configuration.

### Future Roadmap
Future enhancements include:
   - **Enhanced Email Functionality:**<br>
         Integration with decentralized storage (e.g., Arweave) for off-chain email content.

   - **Email Encryption:**<br>
         End-to-end encryption to ensure privacy.

   - **Advanced Spam Filtering & Rewards:**<br>
         Implement tokenomics and user-defined filters.

   - **User Profile Enhancements:**<br>
         Support additional fields such as full name, recovery options, and avatar pointers.

   - **UI Integration:**<br>
         A web-/ mobile-based email client interface for a complete user experience.

### Contributing
Contributions to and discussions of my project are welcome. I am a learner developer with aspiratons of producing a professional quality project. I am appreciative of helpful criticism and/ or just plain old help! Please contact me at rgmelvinphd@gmail.com to discuss.

### License
This project is licensed under the MIT License.
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
No file chosen
Attach files by dragging & dropping, selecting or pasting them.
Editing solana-email/README.md at main · rgmelvin/solana-email