import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { SolanaEmailIdentity } from "../target/types/solana_email_identity";
import { assert } from "chai";

// Define the expected shape for the RegisterUser instruction's accounts.
interface RegisterUserAccounts {
  userProfile: anchor.web3.PublicKey;
  owner: anchor.web3.PublicKey;
  systemProgram: anchor.web3.PublicKey;
}

// Helper function: Airdrop SOL to a new keypair.
async function airdropKeypair(keypair: Keypair, amount = 2 * LAMPORTS_PER_SOL) {
  const provider = anchor.AnchorProvider.local();
  const sig = await provider.connection.requestAirdrop(keypair.publicKey, amount);
  const latestBlockhash = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, "confirmed");
  // Allow a moment for the airdrop to settle.
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

describe("solana_email_identity", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaEmailIdentity as Program<SolanaEmailIdentity>;

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

    const userProfileAccount = await program.account.userProfile.fetch(userProfilePda);
    console.log("UserProfile Account:", userProfileAccount);
    assert.ok(userProfileAccount.owner.equals(newUser.publicKey), "The account owner should match the new user's public key.");
    assert.equal(userProfileAccount.displayName, "", "Display name should initially be empty");
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

    const updatedProfile = await program.account.userProfile.fetch(userProfilePda);
    console.log("Updated UserProfile:", updatedProfile);
    assert.equal(updatedProfile.displayName, newDisplayName, "Display name should be updated");
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
    } catch (err) {
      console.log("User profile successfully closed");
    }
  });

  // Test 4: Sends an email with spam prevention deposit.
  it("Sends an email with spam prevention deposit", async () => {
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
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([sender])
      .rpc();

    const emailAccount = await program.account.email.fetch(emailAccountPda);
    console.log("Email Account:", emailAccount);
    assert.ok(emailAccount.sender.equals(sender.publicKey), "The email account's sender should match the wallet public key.");
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
    } catch (err: any) {
      console.log("Unauthorized update error:", err.toString());
      // Check that the error string includes "2006" (ConstraintSeeds error).
      assert.include(err.toString(), "2006", "Expected error code 2006 for unauthorized update");
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
    } catch (err: any) {
      console.log("Duplicate registration error:", err.toString());
      assert.include(err.toString(), "already in use", "Expected duplicate registration error message to include 'already in use'");
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
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .signers([poorSender])
            .rpc();
        assert.fail("Send email should have failed due to insufficient funds");
    } catch (err: any) {
        console.log("Insufficient deposit error:", err.toString());
        // Check that the error message includes "insufficient lamports".
        assert.include(err.toString(), "insufficient lamports", "Expected error due to insufficient funds");
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
    } catch (err: any) {
        console.log("Long display name error:", err.toString());
        assert.include(err.toString(), "Failed to serialize the account.", "Expected error due to input length exceeding limit");
    }
  });

  // Test 9: Sequential End-to-End Flow
  it("Performs a complete user journey", async () => {
    const user = Keypair.generate();
    await airdropKeypair(user);

    // Derive the PDA for the user profile.
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
        .rpc()
    
    // Update the user's display name.
    const newDisplayName = "TestUser";
    await program.methods
        .updateUser(newDisplayName)
        .accounts({
            userProfile: userProfilePda,
            owner: user.publicKey,
        })
        .signers([user])
        .rpc();

    // Derive PDA for email account.
    const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("email_account"), user.publicKey.toBuffer()],
        program.programId
    );
    // Derive PDA for vault account.
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
    );

    // Send an email.
    await program.methods
        .sendEmail()
        .accounts({
            sender: user.publicKey,
            emailAccount: emailAccountPda,
            vault: vaultPda,
            systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();
    
    // Unregister (close) the user profile.
    await program.methods
        .unregisterUser()
        .accounts({
            userProfile: userProfilePda,
            owner: user.publicKey,
        })
        .signers([user])
        .rpc;

    // Verify that the user profile has been closed.
    try {
        await program.account.userProfile.fetch(userProfilePda);
        assert.fail("User profile should have been closed");
    } catch (err) {
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
    } catch (err: any) {
        console.log("Unauthorized closure error:", err.toString());
        assert.include(err.toString(), "A seeds constraint was violated.", "Expected unauthorized closure error");
    }
  });
});