import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SolanaEmailIdentity } from "../target/types/solana_email_identity";
import { assert } from "chai";

// ----------------------------------------
// Interface definitions.
// ----------------------------------------
interface InitializeConfigAccounts {
  config: PublicKey;
  admin: PublicKey;
  systemProgram: PublicKey;
}

interface SendEmailAccounts {
  sender: PublicKey;
  emailAccount: PublicKey;
  vault: PublicKey;
  adminVault: PublicKey;
  config: PublicKey;
  systemProgram: PublicKey;
}

interface RegisterUserAccounts {
  userProfile: PublicKey;
  owner: PublicKey;
  systemProgram: PublicKey;
}

interface WithdrawAdminFeesAccounts {
  admin: PublicKey;
  config: PublicKey;
  adminVault: PublicKey;
  systemProgram: PublicKey;
}

// --------------------------------------------------
// Helper Functions
// --------------------------------------------------
async function airdropKeypair(keypair: Keypair, amount = 2 * LAMPORTS_PER_SOL) {
  const provider = anchor.AnchorProvider.local();
  const sig = await provider.connection.requestAirdrop(
    keypair.publicKey,
    amount
  );
  const latestBlockhash = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );
  await new Promise((resolve) => setTimeout(resolve, 800));
}

// Helper function to initialize configuration for tests.
async function initializeTestConfig(
  program: Program<SolanaEmailIdentity>,
  feeRate = 15
) {
  const admin = Keypair.generate();
  await airdropKeypair(admin);

  //Derive the PDA for the configuration account.
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // Call initialize_config.
  await program.methods
    .initializeConfig(feeRate)
    .accounts({
      config: configPda,
      admin: admin.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as InitializeConfigAccounts)
    .signers([admin])
    .rpc();

  return { admin, configPda };
}

// ----------------------------------------
// Test Suite
// ----------------------------------------
describe("Solana Email Identity Service", () => {
  // Set up provider and program reference.
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SolanaEmailIdentity as Program<SolanaEmailIdentity>;

  // Store the provider and program reference to reuse them in multiple tests.
  let adminKeypair: Keypair;
  let configPda: PublicKey;
  let adminVaultPda: PublicKey;

  // ------------------------------------------------------
  // Setup: Initialize config ONCE before all tests
  // ------------------------------------------------------
  before(async () => {
    const result = await initializeTestConfig(program, 15);
    adminKeypair = result.admin;
    configPda = result.configPda;

    [adminVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("admin_vault")],
      program.programId
    );
  });

  // --------------------------------------------------
  // Configuration Tests
  // --------------------------------------------------
  describe("Configuration", () => {
    it("Verifies that the config was intialized properly", async () => {
      // Fetch the config to verify
      const configAccount = await program.account.config.fetch(configPda);
      console.log("Initialized Config:", configAccount);

      assert.ok(
        configAccount.admin.equals(adminKeypair.publicKey),
        "Admin key should match the initializing admin"
      );
      assert.equal(
        configAccount.feeRate,
        15,
        "Fee rate should be initialized to 15"
      );
      assert.equal(
        configAccount.totalFeesCollected.toNumber(),
        0,
        "Total fees should be 0 at initialization"
      );
    });

    it("Updates the configuration", async () => {
      // Now update the fee to 20%.
      await program.methods
        .updateConfig(20)
        .accounts({
          config: configPda,
          admin: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();

      const configAccount = await program.account.config.fetch(configPda);
      console.log("Updated Config:", configAccount);
      assert.equal(
        configAccount.feeRate,
        20,
        "Fee rate should be updated to 20"
      );
    });

    //----------------------------------------
    // Set up an email and withdraw admin fees using "withdrawAdminFees".
    //----------------------------------------
    it("Allows the admin to withdraw accumulated fees from the adminVault", async () => {
      // Create a user who will send an email so fees accumulate.
      const user = Keypair.generate();
      await airdropKeypair(user, 1 * LAMPORTS_PER_SOL);

      // Derive PDA for email account and vault.
      const [emailAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("email_account"), user.publicKey.toBuffer()],
        program.programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      // Have the user send an email (This will pay the deposit + fee).
      await program.methods
        .sendEmail()
        .accounts({
          sender: user.publicKey,
          emailAccount: emailAccountPda,
          vault: vaultPda,
          adminVault: adminVaultPda,
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as SendEmailAccounts)
        .signers([user])
        .rpc();

      // Check that fees have been accumulated.
      let configAccount = await program.account.config.fetch(configPda);
      console.log("Config before withdrawal:", configAccount);
      assert.isTrue(
        configAccount.totalFeesCollected.gt(new anchor.BN(0)),
        "Fees should have been accumulated from email deposit"
      );

      // Have the admin withdraw half of the accumulated fees.
      const withdrawAmountBN = configAccount.totalFeesCollected.div(
        new anchor.BN(2)
      );

      await program.methods
        .withdrawAdminFees(withdrawAmountBN)
        .accounts({
          admin: adminKeypair.publicKey,
          config: configPda,
          adminVault: adminVaultPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as WithdrawAdminFeesAccounts)
        .signers([adminKeypair])
        .rpc();

      // Verify that the total fees have been reduced accordingly.
      configAccount = await program.account.config.fetch(configPda);
      console.log("Config after withdrawl:", configAccount);
      // Expect remaining fees to equal half of what was originally accumulated.
      assert.isTrue(
        configAccount.totalFeesCollected.eq(withdrawAmountBN),
        "Total fees should equal the remaining half withdrawal"
      );
    });
  });

  // --------------------------------------------------
  // User and Email Functionality Tests
  // --------------------------------------------------
  describe("User Operations", () => {
    // Test 1: Can register a new user.
    it("Can register a new user", async () => {
      const newUser = Keypair.generate();
      await airdropKeypair(newUser);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), newUser.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([newUser])
        .rpc();

      const userProfileAccount = await program.account.userProfile.fetch(
        userProfilePda
      );
      console.log("UserProfile Account:", userProfileAccount);
      assert.ok(
        userProfileAccount.owner.equals(newUser.publicKey),
        "The account owner should match the new user's public key."
      );
      assert.equal(
        userProfileAccount.displayName,
        "",
        "Display name should initially be empty"
      );
    });

    // Test 2: Can update a user's display name.
    it("Can update a user's display name", async () => {
      const newUser = Keypair.generate();
      await airdropKeypair(newUser);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), newUser.publicKey.toBuffer()],
        program.programId
      );

      // Register the user.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([newUser])
        .rpc();

      // Update the user's display name.
      const newDisplayName = "Alice";
      await program.methods
        .updateUser(newDisplayName)
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      const updatedProfile = await program.account.userProfile.fetch(
        userProfilePda
      );
      console.log("Updated UserProfile:", updatedProfile);
      assert.equal(
        updatedProfile.displayName,
        newDisplayName,
        "Display name should be updated"
      );
    });

    // Test 3: Can unregister a user (close user profile).
    it("Can unregister a user (close user profile)", async () => {
      const newUser = Keypair.generate();
      await airdropKeypair(newUser);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), newUser.publicKey.toBuffer()],
        program.programId
      );

      // Register the user.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([newUser])
        .rpc();

      // Unregister (close) the user profile.
      await program.methods
        .unregisterUser()
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      try {
        await program.account.userProfile.fetch(userProfilePda);
        assert.fail("User profile should have been closed");
      } catch {
        console.log("User profile successfully closed");
      }
    });

    // Test 4: Sends an email with spam prevention deposit (and admin vault).
    it("Sends an email with spam prevention deposit", async () => {
      // config is already initiated, just create a new user
      const sender = Keypair.generate();
      await airdropKeypair(sender);

      const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("email_account"), sender.publicKey.toBuffer()],
        program.programId
      );
      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      await program.methods
        .sendEmail()
        .accounts({
          sender: sender.publicKey,
          emailAccount: emailAccountPda,
          vault: vaultPda,
          adminVault: adminVaultPda,
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as SendEmailAccounts)
        .signers([sender])
        .rpc();

      const emailAccount = await program.account.email.fetch(emailAccountPda);
      console.log("Email Account:", emailAccount);
      assert.ok(
        emailAccount.sender.equals(sender.publicKey),
        "The email account's sender should match the wallet public key."
      );
    });

    // Test 5: Unauthorized Update (should fail).
    it("Fails to update display name with an unauthorized signer", async () => {
      const newUser = Keypair.generate();
      const unauthorizedUser = Keypair.generate();
      await airdropKeypair(newUser);
      await airdropKeypair(unauthorizedUser);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), newUser.publicKey.toBuffer()],
        program.programId
      );

      // Register the authorized user.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([newUser])
        .rpc();

      // Attempt to update using the unauthorized user.
      try {
        await program.methods
          .updateUser("UnauthorizedUpdate")
          .accounts({
            userProfile: userProfilePda,
            owner: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Unauthorized update should have failed");
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.toString() : String(err);
        console.log("Unauthorized update error:", errorStr);
        // Check that the error string includes "2006" (ConstraintSeeds error).
        assert.include(
          errorStr,
          "2006",
          "Expected error code 2006 for unauthorized update"
        );
      }
    });

    // Test 6: Duplicate Registration Handling.
    it("Fails duplicate registration for the same user", async () => {
      const user = Keypair.generate();
      await airdropKeypair(user);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), user.publicKey.toBuffer()],
        program.programId
      );

      // First registration should succeed.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([user])
        .rpc();

      // Second registration should fail.
      try {
        await program.methods
          .registerUser()
          .accounts({
            userProfile: userProfilePda,
            owner: user.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as RegisterUserAccounts)
          .signers([user])
          .rpc();
        assert.fail("Duplicate registration should have failed");
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.toString() : String(err);
        console.log("Duplicate registration error:", errorStr);
        assert.include(
          errorStr,
          "already in use",
          "Expected duplicate registration error message to include 'already in use'"
        );
      }
    });

    // Test 7: Insufficient Deposit/ Transfer Failure
    it("Fails to send an email when sender has insufficient funds", async () => {
      // Generate a keypair WITHOUT airdroping SOL.
      const poorSender = Keypair.generate();

      const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("email_account"), poorSender.publicKey.toBuffer()],
        program.programId
      );
      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      try {
        await program.methods
          .sendEmail()
          .accounts({
            sender: poorSender.publicKey,
            emailAccount: emailAccountPda,
            vault: vaultPda,
            adminVault: adminVaultPda,
            config: configPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as SendEmailAccounts)
          .signers([poorSender])
          .rpc();
        assert.fail("Send email should have failed due to insufficient funds");
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.toString() : String(err);
        console.log("Insufficient deposit error:", errorStr);
        // Check that the error message includes "insufficient lamports".
        assert.include(
          errorStr,
          "insufficient lamports",
          "Expected error due to insufficient funds"
        );
      }
    });

    // Test 8: Field Length - Display Name Too Long
    it("Fails to update display name when input exceeds maximum allowed length", async () => {
      const user = Keypair.generate();
      await airdropKeypair(user);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), user.publicKey.toBuffer()],
        program.programId
      );

      // Register the user.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([user])
        .rpc();

      // Create an excessively long display name
      const longDisplayName = "A".repeat(100);
      try {
        await program.methods
          .updateUser(longDisplayName)
          .accounts({
            userProfile: userProfilePda,
            owner: user.publicKey,
          })
          .signers([user])
          .rpc();
        assert.fail("Update with too long display name should have failed");
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.toString() : String(err);
        console.log("Long display name error:", errorStr);
        assert.include(
          errorStr,
          "Failed to serialize the account.",
          "Expected error due to input length exceeding limit"
        );
      }
    });

    // Test 9: Sequential End-to-End Flow
    it("Performs a complete user journey", async () => {
      // Create a user and airdrop some SOL.
      const user = Keypair.generate();
      await airdropKeypair(user);

      // Register the user.
      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), user.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([user])
        .rpc();

      // Fetch the user profile to verify registration
      let userProfileAccount = await program.account.userProfile.fetch(
        userProfilePda
      );
      console.log("User Profile after registration:", userProfileAccount);
      assert.ok(
        userProfileAccount.owner.equals(user.publicKey),
        "The account owner should match the user's public key."
      );
      assert.equal(
        userProfileAccount.displayName,
        "",
        "Display name should initially be empty."
      );

      // Update the user's display name.
      const displayName = "AliceTestUser";
      await program.methods
        .updateUser(displayName)
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Verify the updated display name.
      userProfileAccount = await program.account.userProfile.fetch(
        userProfilePda
      );
      console.log(
        "User Profile after display name update:",
        userProfileAccount
      );
      assert.equal(
        userProfileAccount.displayName,
        displayName,
        "Display name should have been updated."
      );

      // Send an email (spam deposit)
      // Derive PDA for email account and the vault.
      const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("email_account"), user.publicKey.toBuffer()],
        program.programId
      );
      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      await program.methods
        .sendEmail()
        .accounts({
          sender: user.publicKey,
          emailAccount: emailAccountPda,
          vault: vaultPda,
          adminVault: adminVaultPda,
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as SendEmailAccounts)
        .signers([user])
        .rpc();

      // Verify that the email account was created
      const emailAccount = await program.account.email.fetch(emailAccountPda);
      console.log("Email Account after sending emial:", emailAccount);
      assert.ok(
        emailAccount.sender.equals(user.publicKey),
        "The email account's sender should match the user's public key."
      );

      // Unregister (close) the user profile.
      await program.methods
        .unregisterUser()
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Verify that the user profile has been closed.
      try {
        await program.account.userProfile.fetch(userProfilePda);
        assert.fail("User profile should have been closed");
      } catch {
        console.log("End-to-end: user profile successfully closed");
      }
    });

    // Test 10: Account Closure Edge Case - Unauthorized Closure
    it("Fails to close a user profile with an unauthorized signer", async () => {
      const user = Keypair.generate();
      const unauthorized = Keypair.generate();
      await airdropKeypair(user);
      await airdropKeypair(unauthorized);

      const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), user.publicKey.toBuffer()],
        program.programId
      );

      // Register the user.
      await program.methods
        .registerUser()
        .accounts({
          userProfile: userProfilePda,
          owner: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as RegisterUserAccounts)
        .signers([user])
        .rpc();

      // Attempt to unregister using unauthorized signer.
      try {
        await program.methods
          .unregisterUser()
          .accounts({
            userProfile: userProfilePda,
            owner: unauthorized.publicKey,
          })
          .signers([unauthorized])
          .rpc();
        assert.fail("Unauthorized account closure should have failed");
      } catch (err: unknown) {
        const errorStr = err instanceof Error ? err.toString() : String(err);
        console.log("Unauthorized closure error:", errorStr);
        assert.include(
          errorStr,
          "A seeds constraint was violated.",
          "Expected unauthorized closure error"
        );
      }
    });
  });
});
