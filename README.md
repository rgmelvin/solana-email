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
**Interact with the program using the Anchor TypeScript client. For example, to register a new user:

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

**Your front-end or API client would similarly use the generated IDL to interact with these instructions.

### Testing

