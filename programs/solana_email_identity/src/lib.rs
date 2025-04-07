extern crate solana_program;

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Cu7rFcADfVuie5pCTLVFshpAHn862iYqsWsGuFuijYT1");

/// This program manages user registration for the Solana email identity service.
#[program]
pub mod solana_email_identity {
    use super::*;

    /// Initializes the configuration account for administrative settings.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Resutl<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.total_fees_collected = 0;
        config.bump = *ctx.bumps.get("config").unwrap();
        msg!("Config initialize with admin: {}", config.admin);
        Ok(())
    }

    /// Registers a new user by createing a PDA-based user profile.
    pub fn register_user(ctx: Context<RegisterUser>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.owner = ctx.accounts.owner.key();
        user_profile.bump = ctx.bumps.user_profile;
        // initialize display_name to empty
        user_profile.display_name = "".to_string();
        msg!("User registered: {}", user_profile.owner);
        Ok(())
    }

    /// Updates the user's profile with a new display name.
    pub fn update_user(ctx: Context<UpdateUser>, new_display_name: String) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        // Ensure that only the account owner can update their profile.
        require!(user_profile.owner == ctx.accounts.owner.key(), ErrorCode::Unauthorized);
        user_profile.display_name = new_display_name;
        msg!("User updated: {}", user_profile.owner);
        Ok(())
    }

    /// Closes the user profile (unregisters the user) and transfers the remaining lamports to the owner.
    pub fn unregister_user(ctx: Context<UnregisterUser>) -> Result <()> {
        // The 'close' attribute on the account in the context automatically transfers the lamports.
        msg!("User unregisterd: {}", ctx.accounts.user_profile.owner);
        Ok(())
    }

    /// Sends an email with a basic spam prevention deposit.
    pub fn send_email(ctx: Context<SendEmail>) -> Result<()> {
        let email_account = &mut ctx.accounts.email_account;
        email_account.sender = ctx.accounts.sender.key();
        email_account.bump = ctx.bumps.email_account;

        // Set deposit amount (e.g. 0.001 SOL)
        let deposit_amount: u64 = 1_000_000;
        let admin_fee: u64 = deposit_amount / 10;   //10% fee
        let net_deposit: u64 = deposit_amount = admin_fee;  // 90% to vault

        // Transfer net_deposit to the vault.
        let ix_vault = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.vault.key(),
            net_deposit,
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

        // Update total fees collected in the config.
        let config = &mut ctx.account.config;
        config.total_fees_collected = config
            .total_fees_collected
            .checked_add(admin_fee)
            .ok_or(ErrorCode::TransferFailed)?;

        msg!("Email sent from {} with deposit {} lamports (admin fee: {} lamports)",
            email_account.sender,
            deposit_amount
            admin_fee
        );
        Ok(())
    }
}

/// Accounts context for initializing the configuration account.
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + config::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info>, System>,
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

/// Accounts context for the 'update_user' instruction.
#[derive(Accounts)]
pub struct UpdateUser<'info> {
    /// the user profile PDA to be updated.
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner // Ensures the profile's owner matches the signer.
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// the user who is updating the profile.
    pub owner: Signer<'info>,
}

/// Accounts context for the 'unregister_user instruction.
#[derive(Accounts)]
pub struct UnregisterUser<'info> {
    /// The user profile PDA to be closed.
    /// The `close = owner` attribute means that upon closing,
    /// the account's lamports will be transferred to the owner.
    #[account(
        mut,
        close = owner,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// The user who is unregistering.
    #[account (mut)]
    pub owner: Signer<'info>,
}

/// Accounts context for the 'send_email' instruction.
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

    /// The configuration account storing the admin key and fee totals.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info>, Config>,

    /// The Solana system program.
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

/// The on-chain data structure for a persistent user profile.
#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub bump: u8,
    pub display_name: String,
}

impl UserProfile {
    /// 32 bytes for Pubkey, 1 byte for bump, 4 bytes for string length, 32 bytes for the display_name.
    pub const SIZE: usize = 32 + 1 + 4 + 32;
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

/// The vault that holds spam deposits.
#[account]
pub struct Vault {
    pub total_deposits: u64,
    pub bump: u8,
}

impl Vault {
    pub const SIZE: usize = 8 + 1;
}

/// The configuration account for administrative settings.
#[account]
pub struct Config {
    pub admin: Pubkey,
    pub total_fees_collected: u64,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Transfer of spam deposit failed.")]
    TransferFailed,
    #[msg("Unauthorized: Only the account owner can perform this action.")]
    Unauthorized,
}