use anchor_lang::prelude::*;

declare_id!("GVJ4ZBAEBQiGnx9efE4CnvC2DiJviQD2qqyBonBEnpBB");

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

    /// For future expansion, A placeholder for sending an email.
    pub fn send_email(ctx: Context<SendEmail>) -> Result<()> {
        let email_account = &mut ctx.accounts.email_account;
        email_account.sender = ctx.accounts.sender.key();
        msg!("Email sent from: {}", email_account.sender);
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

    /// The account of the user who is regiestering (must be a signer and payer for the account)
    #[account(mut)]
    pub owner: Signer<'info>,

    /// System program for account creation.
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

    /// The Solana system program.
    pub system_program: Program<'info, System>,
}

/// The on-chain data structure for a user profile.
#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub bump: u8,
}

impl UserProfile {
    /// Size of the user profile data (excluding the 8-byte discriminator).
    pub const SIZE: usize = 32 + 1;
}

/// The on-chain data structure for an email.
#[account]
pub struct Email {
    pub sender: Pubkey,
    pub bump: u8,
}

impl Email {
    /// Size of the email account data (excluding the 8-byte discriminator).
    pub const SIZE: usize = 32 +1;
}