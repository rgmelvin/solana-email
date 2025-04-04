# Contributing to Solana Email Identity Service

I welcome contributions from the community! By contributing to this project, you agree to follow my guidelines for quality, style, and collaboration.

### Table of Contents

- [Reporting Issues](reporting-issues)

- [Getting Started](getting-started)

- [Development Workflow](development-workflow)

- [Code Style Guidelines](code-style-guidlines)

- [Testing](testing)

- [Pull Request Process](pull-request-process)

- [Questions](questions)

### Reporting Issues

If you encounter any bugs or have feature requests, please [open an issue](https://github.com/rgmelvin/solana-email/issues) on GitHub. Include as much detail as possible (steps to reproduce, expected behaviour, environment details, etc.).

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Getting Started

1. **Fork the Repository**:
    Click the "Fork" button on the top right of the repository page to create your own copy.

2. **Clone Your Fork**:
```bash
git clone https://github.com/rgmelvin/solana-email.git
cd solana-email
```

3. **Install Dependencies**:
    - Rust: [Install Rust](https://www.rust-lang.org/tools/install) (Recommended: Rust 1.85+)
    - **Anchor CLI**: Follow the [Anchor Installation Guide](https://project-serum.github.io/anchor/getting-started/installation.html) (Version 0.31.0)
    - **Solana CLI**: Follow the [Solana CLI installation instructions](https://docs.solana.com/cli/install-solana-cli-tools) (Version 2.x)
    - **Node.js & Yarn**: [Download Node.js](https://nodejs.org/en/) and [install Yarn](https://yarnpkg.com/)

    Then run:
    ```bash
    yarn install
    ```

4. **Run Tests Locally***:
    Before submitting any changes, run the test suite to ensure everything passes:
    ```bash
    yarn test
    ```

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Development Workflow

I follow a Git-based workflow. Please adhere to the following guidelines:

- **Create a Branch**:
Always create a new branch for your feature or bug fix. Branch names should be descriptive.
```bash
git checkout -b feature/your-feature-name
```
- **Make Changes**:
Make your changes, write tests, and run ```yarn test``` to verify your work.
- **Commit Often**:
Write clear and concise commit messages. Follow the commit message format:
```java
type(scope): short description

Detailed description (if needed)
```
Example:
```SCSS
feat(user-registration): add validation for duplicate registrations
```
- **Push Your Branch**:
```bash
git push origin feature/your-feature-name
```

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Code Style Guidelines

- **Rust Code**:
    - Follow Rust's standard style guidelines.
    - Use ```cargo clippy --all-targets --all-features -- -D warnings``` to check for linting issues.
- **TypeScript/ JavaScript**:
    - Follow the ESLint rules defined in the project.
    - Run ESLint using:
    ```bash
    yarn eslint .
    ```
- **Documentation**:
    Ensure that your code is well-documented, and update the README and Developer Guide as necessary.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Testing

- Write unit tests and integration tests for new features.
- Run the full test suite with:
```bash
yarn test
```
- Ensure that your changes do not break existing tests.
- If you add new functionality then add tests for both the positive cases and the expected failures.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Pull Request Process
1. **Open a Pull Request**:
    Once your changes are ready, open a pull request (PR) against the ```main``` branch of the repository.
2. **PR Description**:
    - Describe the changes made.
    - Reference any related issues.
    - Include screenshots or logs if applicable.
3. **Review Process**:
    - Your PR will be reviewed by the maintainers.
    - Make any requested changes.
    - Once approved, your PR will be merged.

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>
---

### Questions
If you have any questions or need assistance, please open an issue or reach out via email at [rgmelvinphd@gmail.com](mailto:rgmelvinphd@gmail.com). I prefer very open communication.

thank you for helping to make this Solana Email Identity Service better for everyone!

<a href="#table-of-contents" title="Back to Table of Contents">⤴️</a>