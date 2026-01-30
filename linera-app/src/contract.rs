#![no_main]

use linera_sdk::abi::WithContractAbi;
use linera_sdk::views::{RootView, View};
use linera_sdk::{Contract, ContractRuntime};

use activity_log::{ActivityLogAbi, ActivityLogState, ActivityTx, Operation, OperationResponse};

linera_sdk::contract!(ActivityLogContract);

const DEFAULT_RETENTION: u32 = 300;

pub struct ActivityLogContract {
    state: ActivityLogState,
    runtime: ContractRuntime<Self>,
}

impl WithContractAbi for ActivityLogContract {
    type Abi = ActivityLogAbi;
}

impl Contract for ActivityLogContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = Option<u32>;
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = ActivityLogState::load(runtime.root_view_storage_context())
            .await
            .expect("load_state");
        Self { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();
        let retention = match argument {
            Some(value) if value > 0 => value,
            _ => DEFAULT_RETENTION,
        };
        self.state.retention.set(retention);
    }

    async fn execute_operation(&mut self, operation: Operation) -> OperationResponse {
        match operation {
            Operation::AppendEvent { actor, event } => {
                let event = *event;
                if actor != event.actor {
                    return OperationResponse::Err("actor_mismatch".to_string());
                }
                let mut list = match self.state.events.get(&actor).await {
                    Ok(Some(list)) => list,
                    Ok(None) => Vec::new(),
                    Err(_) => return OperationResponse::Err("storage_error".to_string()),
                };
                if list.iter().any(|item| item.id == event.id) {
                    return OperationResponse::Err("event_exists".to_string());
                }
                list.push(event);
                let retention = *self.state.retention.get();
                let limit = if retention == 0 {
                    DEFAULT_RETENTION as usize
                } else {
                    retention as usize
                };
                if list.len() > limit {
                    let overflow = list.len() - limit;
                    list.drain(0..overflow);
                }
                if self.state.events.insert(&actor, list).is_err() {
                    return OperationResponse::Err("storage_error".to_string());
                }
                OperationResponse::Ok
            }
            Operation::UpdateEventStatus {
                actor,
                id,
                status,
                tx,
            } => {
                let mut list = match self.state.events.get(&actor).await {
                    Ok(Some(list)) => list,
                    Ok(None) => return OperationResponse::Err("not_found".to_string()),
                    Err(_) => return OperationResponse::Err("storage_error".to_string()),
                };
                let Some(item) = list.iter_mut().find(|event| event.id == id) else {
                    return OperationResponse::Err("not_found".to_string());
                };
                item.status = status;
                if let Some(update) = tx {
                    merge_tx(&mut item.tx, update);
                }
                if self.state.events.insert(&actor, list).is_err() {
                    return OperationResponse::Err("storage_error".to_string());
                }
                OperationResponse::Ok
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {}

    async fn store(mut self) {
        self.state.save().await.expect("save_state");
    }
}

fn merge_tx(target: &mut Option<ActivityTx>, update: ActivityTx) {
    let tx = target.get_or_insert(ActivityTx {
        source_tx_hash: None,
        dest_tx_hash: None,
    });
    if update.source_tx_hash.is_some() {
        tx.source_tx_hash = update.source_tx_hash;
    }
    if update.dest_tx_hash.is_some() {
        tx.dest_tx_hash = update.dest_tx_hash;
    }
}
