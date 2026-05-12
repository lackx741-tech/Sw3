use ethers::types::Transaction;
use std::collections::HashSet;

pub struct TxFilter {
    watched_addresses: HashSet<String>,
}

impl TxFilter {
    pub fn new(watched_addresses: HashSet<String>) -> Self {
        Self { watched_addresses }
    }

    pub fn is_relevant(&self, tx: &Transaction) -> bool {
        if self.watched_addresses.is_empty() {
            return true;
        }
        let from = format!("{:?}", tx.from).to_lowercase();
        if self.watched_addresses.contains(&from) {
            return true;
        }
        if let Some(to) = tx.to {
            let to_str = format!("{to:?}").to_lowercase();
            if self.watched_addresses.contains(&to_str) {
                return true;
            }
        }
        false
    }
}
