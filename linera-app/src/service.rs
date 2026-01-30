#![no_main]

use async_graphql::{EmptySubscription, Object, Request, Response, Schema, ServerError};
use linera_sdk::abi::WithServiceAbi;
use linera_sdk::views::View;
use linera_sdk::{Service, ServiceRuntime};
use serde::Serialize;
use std::sync::Arc;

use activity_log::{
    ActivityEvent, ActivityLogAbi, ActivityLogState, ActivityStatus, ActivityTx, Operation,
};

linera_sdk::service!(ActivityLogService);

pub struct ActivityLogService {
    runtime: Arc<ServiceRuntime<Self>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EventsPage {
    items: Vec<ActivityEvent>,
    next_cursor: Option<u64>,
}

struct QueryRoot {
    state: ActivityLogState,
}

struct MutationRoot {
    runtime: Arc<ServiceRuntime<ActivityLogService>>,
}

#[Object]
impl QueryRoot {
    async fn events(&self, actor: String, limit: Option<u32>, cursor: Option<u64>) -> String {
        let list = match self.state.events.get(&actor).await {
            Ok(Some(list)) => list,
            Ok(None) => Vec::new(),
            Err(_) => return "{\"items\":[],\"nextCursor\":null}".to_string(),
        };
        let safe_limit = limit.unwrap_or(20).max(1) as usize;
        let offset = cursor.unwrap_or(0) as usize;
        if offset >= list.len() {
            return "{\"items\":[],\"nextCursor\":null}".to_string();
        }
        let items: Vec<_> = list.iter().skip(offset).take(safe_limit).cloned().collect();
        let next_offset = offset + items.len();
        let next_cursor = if next_offset < list.len() {
            Some(next_offset as u64)
        } else {
            None
        };
        let page = EventsPage { items, next_cursor };
        serde_json::to_string(&page).unwrap_or("{\"items\":[],\"nextCursor\":null}".to_string())
    }

    async fn event(&self, actor: String, id: String) -> String {
        let list = match self.state.events.get(&actor).await {
            Ok(Some(list)) => list,
            Ok(None) => Vec::new(),
            Err(_) => return "null".to_string(),
        };
        let event = list.into_iter().find(|item| item.id == id);
        serde_json::to_string(&event).unwrap_or("null".to_string())
    }
}

#[Object]
impl MutationRoot {
    #[graphql(name = "appendEvent")]
    async fn append_event(
        &self,
        actor: String,
        #[graphql(name = "eventJson")] event_json: String,
    ) -> bool {
        let event: ActivityEvent = match serde_json::from_str(&event_json) {
            Ok(event) => event,
            Err(_) => return false,
        };
        if event.actor != actor {
            return false;
        }
        self.runtime.schedule_operation(&Operation::AppendEvent {
            actor,
            event: Box::new(event),
        });
        true
    }

    #[graphql(name = "updateEventStatus")]
    async fn update_event_status(
        &self,
        actor: String,
        id: String,
        status: String,
        #[graphql(name = "txJson")] tx_json: Option<String>,
    ) -> bool {
        let status = match parse_status(&status) {
            Some(status) => status,
            None => return false,
        };
        let tx = match tx_json {
            Some(value) => match serde_json::from_str::<ActivityTx>(&value) {
                Ok(tx) => Some(tx),
                Err(_) => return false,
            },
            None => None,
        };
        self.runtime
            .schedule_operation(&Operation::UpdateEventStatus {
                actor,
                id,
                status,
                tx,
            });
        true
    }
}

impl WithServiceAbi for ActivityLogService {
    type Abi = ActivityLogAbi;
}

impl Service for ActivityLogService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        Self {
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Request) -> Response {
        let state = match ActivityLogState::load(self.runtime.root_view_storage_context()).await {
            Ok(state) => state,
            Err(_) => return Response::from_errors(vec![ServerError::new("storage_error", None)]),
        };
        let schema = Schema::build(
            QueryRoot { state },
            MutationRoot {
                runtime: self.runtime.clone(),
            },
            EmptySubscription,
        )
        .finish();
        schema.execute(query).await
    }
}

fn parse_status(value: &str) -> Option<ActivityStatus> {
    match value {
        "started" => Some(ActivityStatus::Started),
        "approved" => Some(ActivityStatus::Approved),
        "submitted" => Some(ActivityStatus::Submitted),
        "attested" => Some(ActivityStatus::Attested),
        "completed" => Some(ActivityStatus::Completed),
        "failed" => Some(ActivityStatus::Failed),
        _ => None,
    }
}
