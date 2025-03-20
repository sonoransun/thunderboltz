use assist_imap_client::ImapClient;
use assist_imap_sync::ImapSync;
use libsql::Connection;
use tokio::sync::Mutex as TokioMutex;

use crate::db_pool::DbPool;

#[derive(Default)]
pub struct AppState {
    pub db_pool: Option<DbPool>,
    pub imap_client: Option<ImapClient>,
    pub imap_sync: Option<ImapSync>,
}
