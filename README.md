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
You can interact with the deployed program using the Anchor TypeScript client. Below are examples for each of the main instructions.

### Register a New User

This example creates a new user profile. The PDA (Program Derived Address) for the user profile derived from the seed "user_profile" and the owner's public key.

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

### Update User Profile

To update a user's profile (for example, to change the display name), call the updateUser instruction with the new display name. Note that only the owner (registered user) is authorized to perform this update.

```ts
const newDisplayName = "Alice";

// Assuming you have already registered the user and derived the PDA:
await program.methods.updateUser(newDisplayName)
    .accounts({
        userProfile: userProfilePDA,
        owner: user,
    })
    .rpc();
```

### Unregister User

This instruction closes the user profile account and transfers any remaining lamports to the owner's wallet. The ```close``` attribute in the account context ensures that the funds are returned.

```ts
await program.methods.unregisterUser()
    .accounts({
        userProfile: userProfilePDA,
        owner: user,
    })
    .rpc();
```

### Send Email with Spam Prevention Deposit

When sending an email, the program creates an on-chain record (email account) and transfers a small deposit (to deter spam) from the sender to a vault. The email account PDA is derived from the seed ```"email_account"``` and the sender's public key. The vault PDA is derived from a fixed seed (e.g., ```"vault"```).

```ts
const sender = provider.wallet.publicKey;
const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("email_account"), sender.toBuffer()],
    program.programId
);
const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
);

await program.methods.sendEmail()
    .accounts({
        sender: sender,
        emailAccount: emailAccountPda,
        vault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
```

Each of these code snippets assumes that you have built, deployed, and correctly configured the program on your local validator (or target network). Adjust the code as necessary for your environment and further integration with your UI or API.

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

This project is licensed under the Apache License 2.0. see the [LICENSE](LICENSE) file.

### Citation

If you use this software in your research or projects, please cite it as follows:

> **Solana Email Identity Service**
> Richard G. Melvin, 2025.
> Available at: https://github.com/rgmelvin/solana-email
>
> BibTeX:
>```bibtex
>@misc{solana_email_identity,
>  author = {Richard G. Melvin},
>  title = {Solana Email Identity Service},
>  year = {2025}
>  note = {Available at https://github.com/rgmelvin/solana-email}
>}
>```