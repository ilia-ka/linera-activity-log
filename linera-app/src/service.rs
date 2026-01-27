#![no_main]

use linera_sdk::abi::WithServiceAbi;
use linera_sdk::views::View;
use linera_sdk::{Service, ServiceRuntime};

use activity_log::{ActivityLogAbi, ActivityLogState, Query, QueryResponse};

linera_sdk::service!(ActivityLogService);

pub struct ActivityLogService {
  state: ActivityLogState
}

impl WithServiceAbi for ActivityLogService {
  type Abi = ActivityLogAbi;
}

impl Service for ActivityLogService {
  type Parameters = ();

  async fn new(runtime: ServiceRuntime<Self>) -> Self {
    let state = ActivityLogState::load(runtime.root_view_storage_context())
      .await
      .expect("load_state");
    Self { state }
  }

  async fn handle_query(&self, query: Query) -> QueryResponse {
    match query {
      Query::GetEvents { actor, limit, cursor } => {
        let list = match self.state.events.get(&actor).await {
          Ok(Some(list)) => list,
          Ok(None) => Vec::new(),
          Err(_) => return QueryResponse::Err("storage_error".to_string())
        };
        let safe_limit = limit.unwrap_or(20).max(1) as usize;
        let offset = cursor.unwrap_or(0) as usize;
        if offset >= list.len() {
          return QueryResponse::Events {
            items: Vec::new(),
            next_cursor: None
          };
        }
        let items: Vec<_> = list
          .iter()
          .skip(offset)
          .take(safe_limit)
          .cloned()
          .collect();
        let next_offset = offset + items.len();
        let next_cursor = if next_offset < list.len() {
          Some(next_offset as u64)
        } else {
          None
        };
        QueryResponse::Events { items, next_cursor }
      }
      Query::GetEvent { actor, id } => {
        let list = match self.state.events.get(&actor).await {
          Ok(Some(list)) => list,
          Ok(None) => Vec::new(),
          Err(_) => return QueryResponse::Err("storage_error".to_string())
        };
        let event = list.into_iter().find(|item| item.id == id);
        QueryResponse::Event { event }
      }
    }
  }
}
