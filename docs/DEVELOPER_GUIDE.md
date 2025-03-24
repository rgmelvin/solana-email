# Developer Documentation

This document provides an in-depth look at the **Solana Email Identity Service** project. It covers the architectural design, API reference, testing guidlines, and security considerations to ensure that my project meets professional quality standards.

## Table of Contents

- [Architecture](#Architecture)

    - [Overview](#Overview)

    - [Diagrams](#Diagrams)

    - [Technology Stack](#Technology-Stack)

- [API Reference](#API-Reference)

    - [`registerUser`](#registerUser)

    - [`updateUser`](#updateUser)

    - [`unregisterUser`](#unregisterUser)

    - [`sendEmail`](#sendEmail)

- [Testing Guidelines](#Testing-Guidelines)

    - [Test Strategy](#Test-Strategy)

    - [Test Isolation](#Test-Isolation)

    - [Running Tests](#Running-Tests)

- [Security Considerations](#Security-Considerations)

    - [Security Model](#Security-Model)

    - [Security Auditing](#Security-Auditing)

    - [Recommendations](#Recommendations)

- [CI/CD Integration](#CI-CD-Integration)

- [Future Roadmap](#Future-Roadmap)

- [Conclusion](#Conclusion)

---

## Architecture

### Overview
The **Solana Email Identity Service** is a decentralized protocol built on the Solana blockchain using the Anchor framework. It manages user registration and profile management, and provides a mechanism for sending on-chain email metadata with a spam prevention deposit.

Key components include:

- **On-Chain Program**:

    Written in Rust using Anchor. The program implements instructions for user registration, profile updates, unregistration, and sending emails.

- **Program Derived Addresses (PDAs)**:

    Deterministic addresses derived for:

    - **User Profile:** `[b"user_profile", owner.key()]`

    - **Email Account:** `[b"email_account", sender.key()]`

    - **Vault:** `[b"vault"]`

- **Client Integration:**

    A TypeScript client interacts with the on-chain program to create transactions for registering users, updataing profiles, sending emails, etc.


### Diagrams

- **Component Interaction Diagram**:

    ![Diagram_1](component_interaction_diagram.png)

- **Data Flow Diagram**:

    ![Diagram_2](data_flow_diagram.png)

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Technology Stack

- **Rust & Anchor**: For the on-chain program.

- **Solana CLI**: For deploying and interacting with the bockchain.

- **TypeScript & Node.js**: For client integration and testing.

- **GitHub Actions**: For CI/CD pipeline automation.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## API Reference

### `registerUser`

- **Description**: 
    Registers a new user by creating a PDA-based user profile.

- **Accounts**:

    - `userProfile`: PDA derived from `[b"user_profile", owner.key()]`.

    - `owner`: The signer and payer.

    - `systemProgram`: The Solana System Program

- **Arguments**:

    None (defaults are set in the instruction).

- **Custom Errors**:

    - `UserAlreadyRegistered` (fi manually implemented).

### `updateUser`

- **Description**: 
    Updates a user's profile with a new display name (and, in future, additional fields).

- **Accounts**:

    - `userProfile`: Mutable PDA (derived from `[b"user_profile", owner.key()]` ).

    - `owner`: The signer (must match `userProfile.owner`).

- **Arguments**:

    - `new_display_name: String`

- **Custom Errors**:

    - `Unauthorized`: If the signer is not the owner.

    - Optionally, `InputLengthExceeded` if the new display name is too long.

### `unregisterUser`

- **Description**:
    Closes the user profile (unregisters the user) and transfers remaining lamports to the owner.

- **Accounts**:

    - `userProfile`: Mutable PDA with the `close = owner` attribute.

    - `owner`: The signer.

- **Arguments**:

    None.

- **Custom Errors**:

    - `Unauthorized`: If the signer does not match the owner.

### `sendEmail`

- **Description**:
    Sends an email by creating an on-chain email account record and transferring a spam prevention deposit into a vault.

- **Accounts**:

    - `sender`: The signer.

    - `emailAccount`: PDA derived from `[b"email_account", sender.key()]`.

    - `vault`: PDA for spam deposit (inialized if needed).

    - `systemProgram`: The Solana System Program.

- **Arguments**:

    None.

- **Custom Errors**:

    `TransferFailed`: If the lamport transfer fails (e.g., insufficient funds).

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## Testing Guidelines

### Test Strategy

- **Happy Path Tests**:

    Ensure that each instruction works as expected (user registration, update, unregistration, email sending, and full user flow).

- **Negative Tests**:

    Cover error cases such as:

    - Unauthorized updates (only the owner should be able to update).

    - Duplicate registration attempts.

    - Insufficient funds for email sending.

    - Input boundary conditions (e.g., excessively long display names).

- **Edge Cases**:

    Test empty or malformed inputs.

### Isolated Tests

- **New Keypairs**:

    Each test generates a new keypair to derive unique PDAs, ensuring tests do not interfere with each other.

- **Airdrop Helper**:

    Use an airdrop helper function to ensure each keypair has sufficient lamports.

- ** Account Closure**:

    Use close instructoins( e.g., `unregister`) to clean up and avoid state conflicts.

### Running Tests

To run the test suite locally:

1. **Deploy the Program**:

```bash
anchor clean && anchor build && anchor deploy
```

2. **Run Tests**:

```bash
yarn test
```

3. **Review Test Output**:

    Verify that tests cover all of the positive and negative scenarios.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## Security Considerations

### Security Model

- **Authorization**:

    Use constraints (e.g., `has_one = owner`) to ensure that only authorized users can update or unregister accounts.

- **Custom Error Codes**:

    Define custom error codes using the `#[error_code]` macro. For example:

    ```rust
    #[error_code]
    pub enum ErrorCode {
        #[msg("Transfer of spam deposit failed.")]
        TransferFailed,
        #[msg("Unauthorized: Only the account owner can perform this action.")]
        Unauthorized,
        #[msg("User is already registered.")]
        UserAlreadyRegistered,
    }
    ```

- **Acount Data Storage**:

    Calculate account sizes precisely to avoid overflows and minimize on-chain storage costs.

- **CPI Safety**:

    When performing CPI calls (like transferring lamports), map errors to custom error codes for clarity.

### Security Auditing

- **Internal Code Reviews**:

    Regularly review code for common pitfalls (authorization checks, PDA derivation, account sizing).

- **Static Analysis**:

    Run `cargo clippy` for Rust and ESLint for TypeScript.

- **External Audit**:

    Engage a third-party auditor before mainnet deployment.

- **Documentation**:

    Maintain a security guide detailing your design decisions and known limitations.

### Recommendations

- Use automated security tools as part of the CI/CD pipeline.

- Update dependencies regularly and review change logs for security fixes.

- Document any deviations or assumptions in the security model.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---
<a id="ci-cd-integration"></a>
## CI/CD Integration

### GitHub Actions Workflow

Your CI/CD pipeline should automate the following:

- **Checkout the Repository**

- **Set Up Toolchains**:
    
    Configure Rust, Node.js, and Yarn.

- **Cache Dependencies**:

    Cache Cargo and Yarn caches for faster builds.

- **Install CLI Tools**:

    Install the Solana CLI and Anchor CLI.

- **Build and Deploy**:

    run `anchor clean`, `anchor build`, and `anchor deploy`.

- **Run Tests**:

    Execute the test suite using `yarn test`.


Example GitHub Actions workflow file (`.gihub/workflows/ci/yml`):
```yaml
name: Anchor CI

on:
  push:
    branches: [ main ]
  pull_requests:
    branches: [ main ]

jobs:
  build-and-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Rust toolchain
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true

      - name: Cache Cargo dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cargo/registry
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Install Solana CLI
        run: |
          curl -sSfL https://release.solana.com/v1.18.2/jinstall | sh
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH

      - name: Install Anchor CLI
        run: cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked --force

      - name: Set Up Node
        uses: actions/setup-node@v3
        with:
          node-version: '23.7.0'

      - name: Cache Node dependencies
        uses: actions/cache@v3
        with:
          path: ~/.yarn/cache
          key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}

      - name: Install Node dependencies
        run: yarn install

      - name: Build the Anchor program
        run: anchor build

      - name: Deploy the Anchor program
        run: anchor deploy

      - name: Run tests
        run: yarn test
```

### Automated Notificaitons

Configure your CI system (e.g., GitHub Actions) to send notifications (via Discord, email, etc.) if builds or tests fail, ensuring prompt attention to issues.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## Future Roadmap

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## Conclusion

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

## Glossary of Terms

**Client**: Refers to a piece of software that interacts with the Solana network e.g., a TypeScript listing.

**Program Derived Address (PDA)**: A type of address that is deterministically derived using a combination of user-defined seeds, a bump seed, and a program's ID. PDAs look like a standard public key but do not have corresponding private keys. This means that these addresses fall off of the Ed25519 curve and cannot be signed by an external user.

**Remote Procedure Call (RPC)**: A protocol that allows a client to request a service or data from a server, which is typically a node in the Solana network.

**Cross-Program Invocation (CPI)**: A mechanism that allows one Solana program to call another program, similar to how function calls work in traditional programming but CPIs opperate at the level of smart contracts within the Solana blockchain.

**Continuous Integration and Continuous Delivery/Deployment (CI/CD)**: A set of practices in software engineering aimed at streamlining and accelerating the software development lifecycle. **Continuous Integration (CI)** is a practice where developers frequently merge their code changes into a central code repository (GitHub). **Contiuous Delivery (CD)** extends the CI process by ensuring that the software can be released to production at any time by automating building, testing, and packaging. **Continuous Deployment (CD)** is an advanced form of CD where every change that passes the automated testing is automatically deployed to production.

**Solana System Program**: a native program that is crucial for operation of the Solana network. The System program acts as a foundational utility that enables the creation and management of accounts, as well as the transfer of funds and data on the Solana blockchain.


<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>