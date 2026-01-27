pub mod state;

use linera_sdk::abi::{ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

pub use state::{ActivityEvent, ActivityLogState, ActivityStatus, ActivityTx};

pub struct ActivityLogAbi;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Operation {
  AppendEvent { actor: String, event: ActivityEvent },
  UpdateEventStatus {
    actor: String,
    id: String,
    status: ActivityStatus,
    tx: Option<ActivityTx>
  }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum OperationResponse {
  Ok,
  Err(String)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Query {
  GetEvents {
    actor: String,
    limit: Option<u32>,
    cursor: Option<u64>
  },
  GetEvent { actor: String, id: String }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum QueryResponse {
  Events { items: Vec<ActivityEvent>, next_cursor: Option<u64> },
  Event { event: Option<ActivityEvent> },
  Err(String)
}

impl ContractAbi for ActivityLogAbi {
  type Operation = Operation;
  type Response = OperationResponse;
}

impl ServiceAbi for ActivityLogAbi {
  type Query = Query;
  type QueryResponse = QueryResponse;
}
