use linera_sdk::views::{MapView, RegisterView, RootView, ViewStorageContext};
use serde::{Deserialize, Serialize};

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ActivityLogState {
    pub events: MapView<String, Vec<ActivityEvent>>,
    pub retention: RegisterView<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub created_at: String,
    pub actor: String,
    pub app: String,
    pub intent_id: String,
    pub kind: ActivityKind,
    pub status: ActivityStatus,
    pub chains: Option<ActivityChains>,
    pub token: Option<ActivityToken>,
    pub tx: Option<ActivityTx>,
    pub refs: Option<ActivityRefs>,
    pub ai: Option<ActivityAi>,
    pub signals: Option<ActivitySignals>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityChains {
    pub source_chain_id: Option<u32>,
    pub dest_chain_id: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityToken {
    pub symbol: ActivityTokenSymbol,
    pub amount: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityTx {
    pub source_tx_hash: Option<String>,
    pub dest_tx_hash: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRefs {
    pub explorer_source_url: Option<String>,
    pub explorer_dest_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityAi {
    pub mode: ActivityAiMode,
    pub receipt_root: Option<String>,
    pub model: Option<String>,
    pub verdict: Option<ActivityAiVerdict>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivitySignals {
    pub items: Vec<String>,
    pub meta: Option<ActivitySignalsMeta>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySignalsMeta {
    pub deploy_address: Option<String>,
    pub errors: Option<Vec<String>>,
    pub decimals: Option<u32>,
    pub slippage: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityStatus {
    Started,
    Approved,
    Submitted,
    Attested,
    Completed,
    Failed,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActivityKind {
    Bridge,
    Swap,
    Deploy,
    ContractCall,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityAiMode {
    Suggest,
    Approve,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityAiVerdict {
    Approve,
    Deny,
    Suggest,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ActivityTokenSymbol {
    #[serde(rename = "USDC")]
    Usdc,
    #[serde(rename = "EURC")]
    Eurc,
}
