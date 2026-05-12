use ethers::types::Transaction;
use serde::{Deserialize, Serialize};
use tracing::debug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DecodedCall {
    Erc20Transfer { to: String, amount: String },
    Erc20Approve { spender: String, amount: String },
    Permit2 { details: String },
    Sweep { targets: Vec<String> },
    Unknown,
}

pub struct TxDecoder;

const TRANSFER_SELECTOR: [u8; 4] = [0xa9, 0x05, 0x9c, 0xbb];
const APPROVE_SELECTOR: [u8; 4] = [0x09, 0x5e, 0xa7, 0xb3];
const PERMIT2_SELECTOR: [u8; 4] = [0x30, 0xf2, 0x8b, 0x7a];

impl TxDecoder {
    pub fn new() -> Self {
        Self
    }

    pub fn decode(&self, tx: &Transaction) -> DecodedCall {
        let input = tx.input.as_ref();
        if input.len() < 4 {
            return DecodedCall::Unknown;
        }
        let selector: [u8; 4] = input[..4].try_into().unwrap_or([0u8; 4]);
        debug!(selector = ?selector, "decoding tx calldata");

        match selector {
            TRANSFER_SELECTOR if input.len() >= 68 => {
                let to = format!("0x{}", hex::encode(&input[16..36]));
                let amount = format!("0x{}", hex::encode(&input[36..68]));
                DecodedCall::Erc20Transfer { to, amount }
            }
            APPROVE_SELECTOR if input.len() >= 68 => {
                let spender = format!("0x{}", hex::encode(&input[16..36]));
                let amount = format!("0x{}", hex::encode(&input[36..68]));
                DecodedCall::Erc20Approve { spender, amount }
            }
            PERMIT2_SELECTOR => DecodedCall::Permit2 {
                details: format!("0x{}", hex::encode(input)),
            },
            _ => DecodedCall::Unknown,
        }
    }
}

impl Default for TxDecoder {
    fn default() -> Self {
        Self::new()
    }
}
