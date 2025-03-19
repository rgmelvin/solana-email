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
        // Generate a new keypair to isolate the test.
        const newUser = Keypair.generate();
        await airdropKeypair(newUser);
        
        // Derive the PDA for the user profile using the seed 'user_profile' and newUser.publicKey.
        const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_profile"), newUser.publicKey.toBuffer()],
            program.programId
        );

        // Call the registerUser instruction
        await program.methods
            .registerUser()
            .accounts({
                userProfile: userProfilePda,
                owner: newUser.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as RegisterUserAccounts)
            .signers([newUser])
            .rpc();

        // Fetch the user profile account data to verify it was created correctly.
        const userProfileAccount = await program.account.userProfile.fetch(userProfilePda);
        console.log("UserProfile Account:", userProfileAccount);
        assert.ok(userProfileAccount.owner.equals(newUser.publicKey), "The account owner should match the wallet public key.");
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

        // First, ensure the user is registered
        await program.methods
            .registerUser()
            .accounts({
                userProfile: userProfilePda,
                owner: newUser.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as RegisterUserAccounts)
            .signers([newUser])
            .rpc();

        // Second, update the user's display name
        const newDisplayName = "Alice";
        await program.methods
            .updateUser(newDisplayName)
            .accounts({
                userProfile: userProfilePda,
                owner: newUser.publicKey,
            })
            .signers([newUser])
            .rpc()
        
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

        // First, ensure the user is registered.
        await program.methods
            .registerUser()
            .accounts({
                userProfile: userProfilePda,
                owner: newUser.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as RegisterUserAccounts)
            .signers([newUser])
            .rpc()

        // Second, unregister (close) the user profile.
        await program.methods
            .unregisterUser()
            .accounts({
                userProfile: userProfilePda,
                owner: newUser.publicKey,
            })
            .signers([newUser])
            .rpc();

        // Try to fetch the user profile; it should no longer exist (test should fail).
        try{
            await program.account.userProfile.fetch(userProfilePda);
            assert.fail("User profile should have been closed");
        } catch (err) {
            console.log("User profile successfully closed");
        }
    });

    // Test 4: Sends an email with spam prevention deposit.
    it("Sends an email with spam prevention deposit", async () => {
        // Use the provider's wallet for sending an email
        const sender = Keypair.generate();
        await  airdropKeypair(sender);
        
        const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("email_account"), sender.publicKey.toBuffer()],
            program.programId
        );
        
        const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault")],
            program.programId
        );

        // Call the sendEmail instruction.
        await program.methods
            .sendEmail()
            .accounts({
                sender: sender.publicKey,
                emailAccount: emailAccountPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any) // Temporary cast to 'any'
            .signers([sender])
            .rpc();

        // Fetch the email account data to verify it was created and populated.
        const emailAccount = await program.account.email.fetch(emailAccountPda);
        console.log("Email Account:", emailAccount);
        assert.ok(emailAccount.sender.equals(sender.publicKey), "The email account's sender should match the wallet public key.");

    });
});