// lib.rs

// ------------------------------
// Standard Imports
// ------------------------------
extern crate solana_program;

use anchor_lang::prelude::*;
use anchor_lang::system_program;
#[allow(unused_imports)] // Temporary caution, remove if not calling the full path in the future.
use solana_program::system_instruction;

declare_id!("HMfXV3w4VssLF6CNRxG8p8SpxJmJEmbZUPznzSqhw35h");

/// This program manages user registration for the Solana email identity service.
#[program]
pub mod solana_email_identity {
    use super::*;
    use solana_program::system_instruction;

    /// Initializes the configuration account.
    /// The config account stores the admin's public key, the fee rate, and accumulates fees.
    pub fn initialize_config(ctx: Context<InitializeConfig>, fee_rate: u8) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.total_fees_collected = 0;
        require!(fee_rate <= 100, ErrorCode::InvalidFeeRate);
        config.fee_rate = fee_rate; // default 10 - 20% (must be <= 100)
        config.bump = ctx.bumps.config;
        msg!("Config initialize with admin: {}, fee rate: {}%", config.admin, config.fee_rate);
        Ok(())
    }

    /// Updates the configuration.
    /// Only the admin may update settings such as the fee rate.
    pub fn update_config(ctx: Context<UpdateConfig>, new_fee_rate: u8) -> Result<()> {
        // Restrict fee rates to between 0 and 100.
        require!(new_fee_rate <= 100, ErrorCode::InvalidFeeRate);
        let config = &mut ctx.accounts.config;
        config.fee_rate = new_fee_rate;
        msg!("Config updated: new fee rate: {}%", new_fee_rate);
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

    /// Sends an email with a spam prevention deposit.
    /// Deducts an admin fee (determined by fee_rate in config)) and deposits it into the admin vault.
    /// The remainder is deposited into the "user vault" for spam deposits.
    pub fn send_email(ctx: Context<SendEmail>) -> Result<()> {
        let email_account = &mut ctx.accounts.email_account;
        email_account.sender = ctx.accounts.sender.key();
        email_account.bump = ctx.bumps.email_account;

        // Set deposit amount (1_000_000 lamports e.g. 0.001 SOL)
        let deposit_amount: u64 = 1_000_000;

        // Compute admin fee based on config.fee_rate
        let config = &mut ctx.accounts.config;
        let admin_fee = deposit_amount
            .checked_mul(config.fee_rate as u64)
            .ok_or(ErrorCode::TransferFailed)?
            .checked_div(100)
            .ok_or(ErrorCode::TransferFailed)?;

        let net_deposit = deposit_amount
            .checked_sub(admin_fee)
            .ok_or(ErrorCode::TransferFailed)?;

        // ---------------------------------------
        // Transfer net_deposit to the vault.
        // ---------------------------------------
        let ix_vault = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.vault.key(),
            net_deposit,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &ix_vault,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[b"vault", &[ctx.bumps.vault]]],
        )
        .map_err(|_| ErrorCode::TransferFailed)?;

        // --------------------------------------
        // Transfer admin fee from sender to the admin vault (system-owned).
        // --------------------------------------
        let ix_admin_fee = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.admin_vault.key(),
            admin_fee,
        );
        anchor_lang::solana_program::program::invoke(
            &ix_admin_fee,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.admin_vault.clone(), // normal .clone() because it's an AccountInfo
                ctx.accounts.system_program.to_account_info(),
            ],
        )
        .map_err(|_| ErrorCode::TransferFailed)?;

        // Update the config account's fee tally.
        config.total_fees_collected = config
            .total_fees_collected
            .checked_add(admin_fee)
            .ok_or(ErrorCode::TransferFailed)?;

        msg!("Email sent from {} deposit={} admin_fee={} (net_deposit={})",
            email_account.sender,
            deposit_amount,
            admin_fee,
            net_deposit
        );
        
        Ok(())
    }

    /// Allows the admin to withdraw accumulated fees from the admin_vault.
    pub fn withdraw_admin_fees(ctx: Context<WithdrawAdminFees>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        // Ensure only the admin can withdraw.
        require!(ctx.accounts.admin.key() == config.admin, ErrorCode::Unauthorized);
        // Ensure the config has enough total fees tracked
        require!(config.total_fees_collected >= amount, ErrorCode::Insufficientfunds);

        // Perform the transfer from admin_vault --> admin.
        let ix = system_instruction::transfer(
            &ctx.accounts.admin_vault.key(),
            &ctx.accounts.admin.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.admin_vault.to_account_info(),
                ctx.accounts.admin.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[b"admin_vault", &[ctx.bumps.admin_vault]]],
        )
        .map_err(|_| ErrorCode::TransferFailed)?;

        // Decrement total_fees_collected
        config.total_fees_collected = config
            .total_fees_collected
            .checked_sub(amount)
            .ok_or(ErrorCode::TransferFailed)?;

        msg!("Admin withdrew {} lamports from admin_vault", amount);
        Ok(())
    }
}

/// -----------------------------
/// **Context Structures**
/// -----------------------------
/// Accounts context for initializing the configuration account.
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::SIZE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts context for UpdateConfig
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump, has_one = admin
    )]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

/// Accounts context for WithdrawAdminFees
#[derive(Accounts)]
pub struct WithdrawAdminFees<'info> {
    // The admin must sign
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = admin
    )]
    pub config: Account<'info, Config>,

    // The admin_vault from which we will transfer lamports.
    #[account(
        mut,
        seeds = [b"admin_vault"],
        bump
    )]
    /// CHECK: 
    /// Only raw lamports are stored in this system-owned PDA, so it cannot hold any program-owned data.
    /// Since it is derived via `[b"admin_vault"]` seeds, only this program can sign for lamport transfers
    /// using `invoke_signed`. No custom data is read or written from or to this account; it is purely
    /// a system account holding SOL. Therefore, no additional type checks are required.
    pub admin_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
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
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts context for the 'update_user' instruction.
#[derive(Accounts)]
pub struct UpdateUser<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner // Ensures the profile's owner matches the signer.
    )]
    pub user_profile: Account<'info, UserProfile>,
    pub owner: Signer<'info>,
}

/// Accounts context for the 'unregister_user instruction.
#[derive(Accounts)]
pub struct UnregisterUser<'info> {
    #[account(
        mut,
        close = owner, // Upon closing the account's lamports will be transferred to the owner.
        seeds = [b"user_profile", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account (mut)]
    pub owner: Signer<'info>,
}

/// Accounts context for the 'send_email' instruction.
#[derive(Accounts)]
pub struct SendEmail<'info> {
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

    /// The user vault account for spam deposits. It is initialized if needed.
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + Vault::SIZE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// The admin vault for admin fee deposits
    #[account(
        init_if_needed,
        payer = sender,
        owner = system_program::ID,
        space = 0,
        seeds = [b"admin_vault"],
        bump
    )]
    /// CHECK: 
    /// Only raw lamports are stored in this system-owned PDA, so it cannot hold any program-owned data.
    /// Since it is derived via `[b"admin_vault"]` seeds, only this program can sign for lamport transfers
    /// using `invoke_signed`. No custom data is read or written from or to this account; it is purely
    /// a system account holding SOL. Therefore, no additional type checks are required.
    pub admin_vault: AccountInfo<'info>,

    /// The configuration account storing the admin key and fee totals.
    #[account(
        mut,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    /// The Solana system program.
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

/// ---------------------------
/// **Data Structures**
/// ---------------------------
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
    pub fee_rate: u8,
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 32 + 8 + 1 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Transfer of spam deposit failed.")]
    TransferFailed,
    #[msg("Unauthorized: Only the account owner can perform this action.")]
    Unauthorized,
    #[msg("Invalid fee rate provided.")]
    InvalidFeeRate,
    #[msg("Insufficient funds for withdrawl.")]
    Insufficientfunds,
}