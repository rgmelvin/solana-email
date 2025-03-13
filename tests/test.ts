import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaEmailIdentity } from "../target/types/solana_email_identity";
import { assert } from "chai";

// Define the expected shape for the RegisterUser instruction's accounts.
interface RegisterUserAccounts {
    userProfile: anchor.web3.PublicKey;
    owner: anchor.web3.PublicKey;
    systemProgram: anchor.web3.PublicKey;
}

describe("solana_email_identity", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    //Anchor workspace uses the program name from your generated IDL.
    // Note: the IDL auto-converts snake_case Rust field names to camelCase in TypeScript.
    const program = anchor.workspace.SolanaEmailIdentity as Program<SolanaEmailIdentity>;
    

    it("Can register a new user", async () => {
        // Get the payer's public key (the wallet used by the provider).
        const user = provider.wallet.publicKey;

        // Derive the PDA for the user profile using the same seeds as in Rust.
        // In Rust we used seeds: [b"user_profile", owner.key().as_ref()]
        const [userProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user_profile"), user.toBuffer()],
            program.programId
        );

        // Call the registerUser instruction.
        // Note: the IDL generated type converts the Rust field 'user_profile'
        // to camelCase on the TS side: 'userProfile'.
        await program.methods
            .registerUser()
            .accounts({
                userProfile: userProfilePda,
                owner: user,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as RegisterUserAccounts)
            .rpc();

        // Fetch the user profile account data to verify it was created correctly.
        const data = await program.account.userProfile.fetch(userProfilePda);
        console.log("UserProfile Account:", data);

        // Assertions:
        // Check that the owner stored in the account matches the wallet.
        assert.ok(data.owner.equals(user), "The account owner should match the wallet public key.");
    });

    it("Sends an email with spam prevention deposit", async () => {
        const sender = provider.wallet.publicKey;
        // Derive the PDA for the email account using seed "email_account"
        const [emailAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("email_account"), sender.toBuffer()],
            program.programId
        );
        // Derive the PDA for the vault using a fixed seed "vault".
        const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault")],
            program.programId
        );

        // Call the sendEmail instruction.
        await program.methods
            .sendEmail()
            .accounts({
                sender: sender,
                emailAccount: emailAccountPda,
                vault: vaultPda,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any) // Temporary cast to 'any'
            .rpc();

        // Fetch the email account data to verify it was created and populated.
        const emailAccount = await program.account.email.fetch(emailAccountPda);
        console.log("Email Account:", emailAccount);
        assert.ok(emailAccount.sender.equals(sender), "The email account's sender should match the wallet public key.");

    });
});