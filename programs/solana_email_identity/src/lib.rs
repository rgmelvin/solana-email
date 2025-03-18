use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("FCN9dmSwzfY6ygooW1ZeQaSxhc5QqtdBMFg5cnxPe4PC");

/// This program manages user registration for the Solana email identity service.
#[program]
pub mod solana_email_identity {
    use super::*;

    /// Registers a new user by createing a PDA-based user profile.
    /// The profile is derived from the seed: ["user_profile", owner.key()] and stores
    /// the owner's public key and the bump
    pub fn register_user(ctx: Context<RegisterUser>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.owner = ctx.accounts.owner.key();
        // Retrieve the bump that Anchor calculated during account validation.
        user_profile.bump = ctx.bumps.user_profile;
        msg!("User registered: {}", user_profile.owner);
        Ok(())
    }

    /// Sends an email with a basic spam prevention deposit.
    /// The email account PDA is derived from [b"email_account", sender.key()].
    /// A fixed deposit of lamports is transferred from the sender to the vault.
    pub fn send_email(ctx: Context<SendEmail>) -> Result<()> {
        let email_account = &mut ctx.accounts.email_account;
        email_account.sender = ctx.accounts.sender.key();
        email_account.bump = ctx.bumps.email_account;

        // Set deposit amount (e.g. 0.001 SOL)
        let deposit_amount: u64 = 1_000_000;

        // Transfer lamports from sender to vault using CPI to system program.
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.vault.key(),
            deposit_amount,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[b"vault", &[ctx.bumps.vault]]],
        )
        .map_err(|_| ErrorCode::TransferFailed)?;
        msg!("Email sent from {} with deposit {} lamports", email_account.sender, deposit_amount);
        Ok(())
    }
}

/// Accounts context for the 'register_user' instruction.
#[derive(Accounts)]
pub struct RegisterUser<'info> {
    /// the user profile PDA to be created, derived from the seed: "user_profile" and the owner's key
    #[account(
        init,
        payer = owner,
        space = 8 + UserProfile::SIZE, // 8 for discriminator + size of state
        seeds = [b"user_profile", owner.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// The wallet of the user (payer and signer).
    #[account(mut)]
    pub owner: Signer<'info>,

    /// System program for account creation.
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendEmail<'info> {
    /// The sender of the email.
    #[account(mut)]
    pub sender: Signer<'info>,

    /// The email account PDA to be created, derived from the seed: "email_account" and the sender's key.
    #[account(
        init,
        payer = sender,
        space = 8 + Email::SIZE,
        seeds = [b"email_account", sender.key().as_ref()],
        bump
    )]
    pub email_account: Account<'info, Email>,

    /// The vault account for spam deposits. It is initialized if needed.
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + Vault::SIZE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// The Solana system program.
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

/// The on-chain data structure for a persistent user profile.
#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub bump: u8,
}

impl UserProfile {
    /// Size of the user profile data (excluding the 8-byte discriminator).
    pub const SIZE: usize = 32 + 1;
}

/// The on-chain data structure for persistent email account.
#[account]
pub struct Email {
    pub sender: Pubkey,
    pub bump: u8,
}

impl Email {
    /// Size of the email account data (excluding the 8-byte discriminator).
    pub const SIZE: usize = 32 +1;
}

// The vault that holds spam deposits.
#[account]
pub struct Vault {
    pub total_deposits: u64,
    pub bump: u8,
}

impl Vault {
    pub const SIZE: usize = 8 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Transfer of spam deposit failed.")]
    TransferFailed,
}