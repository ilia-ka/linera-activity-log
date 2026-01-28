pub mod state;

use async_graphql::{Request, Response};
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

impl ContractAbi for ActivityLogAbi {
  type Operation = Operation;
  type Response = OperationResponse;
}

impl ServiceAbi for ActivityLogAbi {
  type Query = Request;
  type QueryResponse = Response;
}
